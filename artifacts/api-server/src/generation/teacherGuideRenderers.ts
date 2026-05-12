import type {
  AnswerKeyData,
  CommonStudentQuestionsData,
  CreativeResponseErrorsData,
  DifferentiatedSupportsData,
  ExitTicketData,
  GetReadyToReadData,
  GuidedReadingData,
  HomeschoolParentGuideData,
  MeasurableObjectivesData,
  StandardsData,
  StandardsMappingData,
  ThinkAboutTheStoryAnswersData,
  WordsToKnowMiniLessonData,
} from "./teacherGuideTypes.js";
import { getStandardsForGrade } from "../standards/index.js";
import type { GradeLevel } from "../standards/types.js";
import type { ChapterMeta, GeneratedSection } from "./templateRenderers.js";
import { sanitizeLlmBodyHtml } from "./htmlSanitizer.js";
import type { VocabularyWord } from "../vocabulary/types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLessonOverview(): string {
  return `<p>Use this guide to introduce the chapter, support close reading, and prepare students for discussion and writing.</p>
<p>This guide is designed for a 60-minute instructional period or two 30-minute sessions.</p>`;
}

export function renderStandards(data: StandardsData, grade: GradeLevel): string {
  const strandOrder = ["RL", "RI", "W", "L", "SL"] as const;
  const strandLabels: Record<(typeof strandOrder)[number], string> = {
    RL: "Reading Literature",
    RI: "Reading Informational Text",
    W: "Writing",
    L: "Language",
    SL: "Speaking and Listening",
  };

  const codeMap = new Map(
    strandOrder.flatMap((s) => getStandardsForGrade(grade, s)).map((s) => [s.code, s] as const),
  );

  const grouped: Record<string, Array<{ code: string; description: string }>> = {};
  for (const item of data.standards) {
    const standard = codeMap.get(item.code);
    const strand = standard?.strand ?? item.code.split(".")[0];
    if (!strandOrder.includes(strand as (typeof strandOrder)[number])) continue;
    if (!grouped[strand]) grouped[strand] = [];
    grouped[strand].push({
      code: item.code,
      description: standard?.text ?? "",
    });
  }

  const blocks = strandOrder
    .filter((s) => grouped[s] && grouped[s].length > 0)
    .map((strand) => {
      const items = grouped[strand]
        .map((s) =>
          `  <li><strong>${escapeHtml(s.code)}</strong>${s.description ? ` — ${escapeHtml(s.description)}` : ""}</li>`,
        )
        .join("\n");
      return `<div class="tg-standards-strand">\n  <h4>${escapeHtml(strandLabels[strand])}</h4>\n  <ul class="tg-standards-list">\n${items}\n  </ul>\n</div>`;
    })
    .join("\n");

  return blocks || `<p><em>No standards selected for this chapter.</em></p>`;
}

export function renderMaterialsNeeded(meta: ChapterMeta): string {
  const chapterRef = meta.chapterNum != null ? `Chapter ${meta.chapterNum}` : meta.chapterTitle;
  return `<ul>
  <li>${escapeHtml(meta.bookTitle)}, by ${escapeHtml(meta.author)} (Classic Books for All edition), ${escapeHtml(chapterRef)}, for each student.</li>
  <li>Classic Books for All ${escapeHtml(meta.bookTitle)} Student Workbook.</li>
  <li>Pencil and notebook.</li>
  <li>Whiteboard and markers.</li>
  <li>Optional: Drawing paper and colored pencils.</li>
</ul>`;
}

export function renderMeasurableObjectives(data: MeasurableObjectivesData): string {
  return `<ul>
${data.objectives
  .map((o) => `  <li>Students will be able to ${escapeHtml(o.text)} (${escapeHtml(o.standardCode)})</li>`)
  .join("\n")}
</ul>`;
}

export function renderGetReadyToRead(data: GetReadyToReadData, focusQuestion: string): string {
  const promptText = focusQuestion.trim() || "What do you think this chapter will be about?";
  return `<div class="tg-get-ready">
  <h4 class="tg-emphasis-heading">Quick-write prompt</h4>
  <p>"${escapeHtml(promptText)}"</p>
  <h4 class="tg-emphasis-heading">Implementation</h4>
  <ul class="tg-impl-steps">
${data.implementationSteps.map((s) => `    <li>${escapeHtml(s)}</li>`).join("\n")}
  </ul>
  <div class="tg-tip"><strong>Connection tip:</strong> ${escapeHtml(data.connectionTip)}</div>
</div>`;
}

export function renderWordsToKnowMiniLesson(data: WordsToKnowMiniLessonData, vocabulary: VocabularyWord[]): string {
  const wordList = vocabulary
    .map((v, i) => `    <li>${escapeHtml(v.word)} <em>(page ${v.page_number})</em></li>`)
    .join("\n");
  return `<div class="tg-words">
  <h4 class="tg-emphasis-heading">Mini-lesson</h4>
  <ol>
${wordList}
  </ol>
  <h4 class="tg-emphasis-heading">Activities</h4>
  <p><strong>Introduce words with context</strong></p>
  <ul>
    <li>Write each word on the board.</li>
    <li>Read the sentence from the book containing the word.</li>
    <li>Think-aloud: "What clues help me understand this word?"</li>
    <li>Example for <em>${escapeHtml(data.workedWord)}</em>: "${escapeHtml(data.workedQuote)}" (p. ${data.workedPage}) — ${escapeHtml(data.contextClueStrategy)}</li>
  </ul>
  <h4>Partner practice</h4>
  <ul>
    <li>Assign partners.</li>
    <li>Each pair gets two to three vocabulary words.</li>
    <li>Partners find the word in the text and discuss what it might mean.</li>
    <li>Use sentence: "I think _____ means _____ because the text says _____."</li>
  </ul>
  <h4>Quick check</h4>
  <ul>
    <li>Call on pairs to share definitions.</li>
    <li>Confirm or clarify meanings.</li>
    <li>Post vocabulary words on Word Wall.</li>
  </ul>
</div>`;
}

export function renderGuidedReading(data: GuidedReadingData): string {
  return `<div class="tg-guided-reading">
${data.sections
  .map(
    (section, i) => `<div class="tg-section-block">
  <h4>Section ${i + 1}: pages ${section.pageStart}–${section.pageEnd}</h4>
  <p>Read from ${escapeHtml(section.openingPhrase)} ...</p>
  <p>Pause and ask:</p>
  <ol class="tg-pause-points">
${section.questions
  .map((q) => `    <li>${escapeHtml(q.text)}</li>`)
  .join("\n")}
  </ol>
</div>`,
  )
  .join("\n")}
  <p class="tg-tip"><strong>Read-aloud tip:</strong> ${escapeHtml(data.readAloudTip)}</p>
</div>`;
}

export function renderThinkAboutTheStoryAnswers(data: ThinkAboutTheStoryAnswersData): string {
  return `<div class="tg-tats-answers">
${data.answers
  .map(
    (a) => `<div class="tg-answer">
  <p><strong>${escapeHtml(a.question)}</strong></p>
  <p>${escapeHtml(a.answer)} (p. ${a.page}).</p>
</div>`,
  )
  .join("\n")}
  <h3 class="tg-emphasis-heading">Inferential Thinking</h3>
  <ul>
${data.inferentialPrompts.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
  <h3 class="tg-emphasis-heading">Tiered Discussion Prompts</h3>
  <p><strong>Literal:</strong> ${escapeHtml(data.tieredDiscussion.literal.join(" | "))}</p>
  <p><strong>Inference:</strong> ${escapeHtml(data.tieredDiscussion.inference.join(" | "))}</p>
  <p><strong>Analysis:</strong> ${escapeHtml(data.tieredDiscussion.analysis.join(" | "))}</p>
  <p><strong>Evaluation:</strong> ${escapeHtml(data.tieredDiscussion.evaluation.join(" | "))}</p>
  <h3 class="tg-emphasis-heading">Analytical Thinking</h3>
  <ul>
${data.analyticalThinking.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
  <h3 class="tg-emphasis-heading">Personal Connection</h3>
  <ul>
${data.personalConnection.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
</div>`;
}

export function renderDifferentiatedSupports(data: DifferentiatedSupportsData): string {
  const renderGroup = (title: string, phases: { before: string[]; during: string[]; after: string[] }) =>
    `<div class="tg-support-group">
  <h4 class="tg-emphasis-heading">${escapeHtml(title)}</h4>
  <p><strong>Before reading:</strong> ${escapeHtml(phases.before.join(" | "))}</p>
  <p><strong>During reading:</strong> ${escapeHtml(phases.during.join(" | "))}</p>
  <p><strong>After reading:</strong> ${escapeHtml(phases.after.join(" | "))}</p>
</div>`;

  return `<div class="tg-differentiated-supports">
${renderGroup("Struggling Readers", data.strugglingReaders)}
${renderGroup("English Language Learners", data.englishLanguageLearners)}
${renderGroup("Advanced Students", data.advancedStudents)}
</div>`;
}

export function renderCommonStudentQuestions(data: CommonStudentQuestionsData): string {
  return `<ol class="tg-csq">
${data.questions
  .map(
    (q) => `  <li><strong>${escapeHtml(q.studentQ)}</strong>${q.page ? ` (p. ${q.page})` : ""}<br/>${escapeHtml(q.teacherA)}</li>`,
  )
  .join("\n")}
</ol>`;
}

export function renderCreativeResponseErrors(data: CreativeResponseErrorsData): string {
  const title = `Retelling The Whole Chapter Instead of Focusing on ${data.characterName}'s Experience`;
  const errors = [
    ["No Specific Details From The Chapter", data.errors.noSpecificDetails],
    ["Breaking Character", data.errors.breakingCharacter],
    [title, data.errors.retelling],
    ["No Evidence From the Text", data.errors.noEvidence],
    ["Modern Language That Doesn't Fit The Story", data.errors.modernLanguage],
  ] as const;
  return `<div class="tg-common-errors">
${errors
  .map(
    ([heading, body]) => `<div class="tg-error-block">
  <h4 class="tg-emphasis-heading tg-no-italic">${escapeHtml(heading)}</h4>
  <p>${escapeHtml(body.paragraph)}</p>
  <p><strong>Weak example:</strong> ${escapeHtml(body.weakExample)}</p>
  <p><strong>How to fix:</strong> ${escapeHtml(body.howToFix)}</p>
</div>`,
  )
  .join("\n")}
</div>`;
}

export function renderExitTicket(data: ExitTicketData): string {
  return `<div class="tg-exit-ticket">
  <p><strong>Prompt</strong>: ${escapeHtml(data.prompt)}</p>
  <h4>Success Criteria</h4>
  <ul>
${data.successCriteria.map((s) => `    <li>${escapeHtml(s)}</li>`).join("\n")}
  </ul>
  <h4>Example Responses</h4>
  <p><strong>Strong:</strong> ${escapeHtml(data.strongExample)}</p>
  <p><strong>Developing:</strong> ${escapeHtml(data.developingExample)}</p>
</div>`;
}

/**
 * Literal "next chapter teaser" placeholder. Rendered bold + italic + ALL CAPS
 * inside parentheses so reviewers can see exactly where a teaser would go.
 */
const NEXT_CHAPTER_TEASER_PLACEHOLDER =
  `<p class="tg-next-chapter-teaser"><strong><em>(INSERT NEXT CHAPTER TEASER)</em></strong></p>`;

export function renderHomeschoolParentGuide(data: HomeschoolParentGuideData): string {
  const list = (items: string[]) =>
    items.map((s) => `    <li>${escapeHtml(s)}</li>`).join("\n");

  const day3Block = data.pacingTips.day3
    ? `\n    <li><strong>Day 3:</strong> ${escapeHtml(data.pacingTips.day3)}</li>`
    : "";

  return `<div class="tg-homeschool">
  <h4 class="tg-emphasis-heading">Chapter Snapshot</h4>
  <p>${escapeHtml(data.chapterSnapshot.synopsis)}</p>
  <p><strong>Why this matters:</strong> ${escapeHtml(data.chapterSnapshot.whyThisMatters)}</p>

  <h4 class="tg-emphasis-heading">Read-Aloud &amp; Pacing Tips</h4>
  <ul>
    <li><strong>Day 1:</strong> ${escapeHtml(data.pacingTips.day1)}</li>
    <li><strong>Day 2:</strong> ${escapeHtml(data.pacingTips.day2)}</li>${day3Block}
  </ul>
  <p><strong>Pause points:</strong></p>
  <ul>
${list(data.pacingTips.pausePoints)}
  </ul>
  <p><strong>Natural stopping points:</strong></p>
  <ul>
${list(data.pacingTips.stoppingPoints)}
  </ul>

  <h4 class="tg-emphasis-heading">Discussion Questions</h4>
  <p><strong>Understanding the story:</strong></p>
  <ul>
${list(data.discussionQuestions.understanding)}
  </ul>
  <p><strong>Thinking deeper:</strong></p>
  <ul>
${list(data.discussionQuestions.thinkingDeeper)}
  </ul>
  <p><strong>Personal connections:</strong></p>
  <ul>
${list(data.discussionQuestions.personalConnections)}
  </ul>

  <h4 class="tg-emphasis-heading">Simple Activity Option</h4>
  <p><strong>${escapeHtml(data.simpleActivity.name)}</strong></p>
  <p><strong>Materials:</strong></p>
  <ul>
${list(data.simpleActivity.materials)}
  </ul>
  <p><strong>Steps:</strong></p>
  <ol>
${data.simpleActivity.steps.map((s) => `    <li>${escapeHtml(s)}</li>`).join("\n")}
  </ol>
  <p><strong>Bonus challenge:</strong> ${escapeHtml(data.simpleActivity.bonusChallenge)}</p>

  <h4 class="tg-emphasis-heading">Helpful Parent Notes</h4>
  <p><strong>Content awareness:</strong></p>
  <ul>
${list(data.parentNotes.contentAwareness)}
  </ul>
  <p><strong>Vocabulary tips:</strong></p>
  <ul>
${list(data.parentNotes.vocabTips)}
  </ul>
  <p><strong>Words to explain:</strong></p>
  <ul>
${list(data.parentNotes.wordsToExplain)}
  </ul>

  <h4 class="tg-emphasis-heading">Encouragement for Parents</h4>
  <p>${escapeHtml(data.encouragement.paragraph)}</p>
  <ul>
${list(data.encouragement.reminders)}
  </ul>

  ${NEXT_CHAPTER_TEASER_PLACEHOLDER}
</div>`;
}

export function renderStandardsMapping(data: StandardsMappingData, grade: GradeLevel): string {
  const strandOrder = ["RL", "RI", "W", "L", "SL"] as const;
  const codeMap = new Map(
    strandOrder.flatMap((s) => getStandardsForGrade(grade, s)).map((s) => [s.code, s] as const),
  );

  if (data.rows.length === 0) {
    return `<p><em>No standards mapped for this chapter.</em></p>`;
  }

  const rows = data.rows
    .map((row) => {
      const standard = codeMap.get(row.code);
      const description = standard?.text ?? "";
      return `      <tr>
        <td><strong>${escapeHtml(row.code)}</strong></td>
        <td>${escapeHtml(description)}</td>
        <td>${escapeHtml(row.howAddressed)}</td>
        <td>${escapeHtml(row.assessmentEvidence)}</td>
      </tr>`;
    })
    .join("\n");

  return `<div class="tg-standards-mapping">
  <table class="tg-standards-mapping-table">
    <thead>
      <tr>
        <th>Standard Code</th>
        <th>Description</th>
        <th>How Addressed</th>
        <th>Assessment Evidence</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
}

export function renderAnswerKey(data: AnswerKeyData, vocabulary: VocabularyWord[]): string {
  const wordsToKnowRows = vocabulary
    .map(
      (v) => `      <tr>
        <td><strong>${escapeHtml(v.word)}</strong></td>
        <td>${escapeHtml(v.kid_friendly_definition ?? "—")}</td>
        <td>"${escapeHtml(v.book_quote)}" (p. ${v.page_number})</td>
        <td>${escapeHtml(v.example_sentence ?? "—")}</td>
      </tr>`,
    )
    .join("\n");

  const bonusChallengeHtml =
    data.bonusChallenge && data.bonusChallenge.length >= 5 && data.bonusChallenge.length <= 7
      ? `<h4 class="tg-emphasis-heading">Bonus Challenge — Answer Key (Correct Order)</h4>
  <ol class="tg-bonus-key">
${data.bonusChallenge.map((event) => `    <li>${escapeHtml(event)}</li>`).join("\n")}
  </ol>`
      : "";

  return `<div class="tg-answer-key">
  <h4 class="tg-emphasis-heading">Words to Know — Answer Key</h4>
  <table class="tg-words-key">
    <thead><tr><th>Word</th><th>Definition</th><th>Sentence from book (page)</th><th>Example sentence</th></tr></thead>
    <tbody>
${wordsToKnowRows}
    </tbody>
  </table>
  <h4 class="tg-emphasis-heading">Reading Between the Lines — Answers</h4>
  <ul>
${data.readingBetweenTheLines.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.answer)} (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4 class="tg-emphasis-heading">Dig Deeper — Answers</h4>
  <ul>
${data.digDeeper.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.answer)} (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4 class="tg-emphasis-heading">Multiple Choice — Answers</h4>
  <ul>
${data.multipleChoice.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.correctLetter)} — ${escapeHtml(a.rationale)}</li>`).join("\n")}
  </ul>
  <h4 class="tg-emphasis-heading">Evidence from the Story — Sample Answers</h4>
  <ul>
${data.evidenceFromTheStory.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.sampleAnswer)} <em>${escapeHtml(a.quote)}</em> (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4 class="tg-emphasis-heading">Character Chart — Answer Key</h4>
  <table class="tg-character-key">
    <thead><tr><th>Character</th><th>Description</th><th>What This Shows</th><th>Quote</th><th>Page</th></tr></thead>
    <tbody>
${data.characterChart.map((a) => `      <tr><td>${escapeHtml(a.characterName)}</td><td>${escapeHtml(a.description)}</td><td>${escapeHtml(a.whatThisShows)}</td><td>${escapeHtml(a.quote)}</td><td>${a.page}</td></tr>`).join("\n")}
    </tbody>
  </table>
  <h4 class="tg-emphasis-heading">Draw It! — Suggested Details</h4>
  <ul>
${data.drawItDetails.map((d) => `    <li>${escapeHtml(d)}</li>`).join("\n")}
  </ul>
  ${bonusChallengeHtml}
</div>`;
}
