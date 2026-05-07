import type {
  AnswerKeyData,
  CommonStudentQuestionsData,
  CreativeResponseErrorsData,
  DifferentiatedSupportsData,
  ExitTicketData,
  GetReadyToReadData,
  GuidedReadingData,
  MeasurableObjectivesData,
  StandardsData,
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
  return `<p>Materials needed</p>
<ul>
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
  return `<div class="tg-get-ready">
  <h4>Quick-write prompt</h4>
  <p>"${escapeHtml(focusQuestion)}"</p>
  <h4>Implementation</h4>
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
  <h4>Mini-lesson</h4>
  <ol>
${wordList}
  </ol>
  <h4>Activities</h4>
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
  <p>Read from ${escapeHtml(section.openingPhrase)} ... ${escapeHtml(section.closingPhrase)}</p>
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
  <h4>Inferential Thinking</h4>
  <ul>
${data.inferentialPrompts.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
  <h4>Tiered Discussion Prompts</h4>
  <p><strong>Literal:</strong> ${escapeHtml(data.tieredDiscussion.literal.join(" | "))}</p>
  <p><strong>Inference:</strong> ${escapeHtml(data.tieredDiscussion.inference.join(" | "))}</p>
  <p><strong>Analysis:</strong> ${escapeHtml(data.tieredDiscussion.analysis.join(" | "))}</p>
  <p><strong>Evaluation:</strong> ${escapeHtml(data.tieredDiscussion.evaluation.join(" | "))}</p>
  <h4>Analytical Thinking</h4>
  <ul>
${data.analyticalThinking.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
  <h4>Personal Connection</h4>
  <ul>
${data.personalConnection.map((p) => `    <li>${escapeHtml(p)}</li>`).join("\n")}
  </ul>
</div>`;
}

export function renderDifferentiatedSupports(data: DifferentiatedSupportsData): string {
  const renderGroup = (title: string, phases: { before: string[]; during: string[]; after: string[] }) =>
    `<div class="tg-support-group">
  <h4>${escapeHtml(title)}</h4>
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
  <h4>${escapeHtml(heading)}</h4>
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

export function renderAnswerKey(data: AnswerKeyData): string {
  return `<div class="tg-answer-key">
  <h4>Reading Between the Lines — Answers</h4>
  <ul>
${data.readingBetweenTheLines.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.answer)} (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4>Dig Deeper — Answers</h4>
  <ul>
${data.digDeeper.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.answer)} (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4>Multiple Choice — Answers</h4>
  <ul>
${data.multipleChoice.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.correctLetter)} — ${escapeHtml(a.rationale)}</li>`).join("\n")}
  </ul>
  <h4>Evidence from the Story — Sample Answers</h4>
  <ul>
${data.evidenceFromTheStory.map((a) => `    <li><strong>${escapeHtml(a.question)}</strong>: ${escapeHtml(a.sampleAnswer)} <em>${escapeHtml(a.quote)}</em> (p. ${a.page})</li>`).join("\n")}
  </ul>
  <h4>Character Chart — Answer Key</h4>
  <table class="tg-character-key">
    <thead><tr><th>Character</th><th>Description</th><th>What This Shows</th><th>Quote</th><th>Page</th></tr></thead>
    <tbody>
${data.characterChart.map((a) => `      <tr><td>${escapeHtml(a.characterName)}</td><td>${escapeHtml(a.description)}</td><td>${escapeHtml(a.whatThisShows)}</td><td>${escapeHtml(a.quote)}</td><td>${a.page}</td></tr>`).join("\n")}
    </tbody>
  </table>
  <h4>Draw It! — Suggested Details</h4>
  <ul>
${data.drawItDetails.map((d) => `    <li>${escapeHtml(d)}</li>`).join("\n")}
  </ul>
</div>`;
}
