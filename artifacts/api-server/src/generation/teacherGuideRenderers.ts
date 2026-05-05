/**
 * HTML renderers for every Teacher Guide section.
 *
 * Each renderer takes typed data (from teacherGuideTypes.ts, validated by
 * teacherGuideJsonParsers.ts) and returns the section's body HTML. Headings,
 * wrapper divs, table columns, ordering — every structural decision lives in
 * this file and nowhere else.
 *
 * Two sections are pure code with NO Claude call:
 *   - renderLessonOverview()     — constant string
 *   - renderMaterialsNeeded()    — built from chapter meta
 */

import { ALL_STANDARDS } from "../standards/elaStandards.js";
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
  SupportPhases,
  ThinkAboutTheStoryAnswersData,
  WordsToKnowMiniLessonData,
} from "./teacherGuideTypes.js";
import type { ChapterMeta } from "./templateRenderers.js";

// ---------------------------------------------------------------------------
// Utility: HTML-escape user-provided strings before injecting into markup.
// ---------------------------------------------------------------------------

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bullets(items: string[]): string {
  return `<ul>\n${items.map((i) => `  <li>${escapeHtml(i)}</li>`).join("\n")}\n</ul>`;
}

function ordered(items: string[]): string {
  return `<ol>\n${items.map((i) => `  <li>${escapeHtml(i)}</li>`).join("\n")}\n</ol>`;
}

function tip(label: string, body: string): string {
  return `<div class="tg-tip"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(body)}</div>`;
}

function subblock(heading: string, innerHtml: string, extraClass?: string): string {
  const classAttr = extraClass ? `tg-subblock ${extraClass}` : "tg-subblock";
  return `<div class="${classAttr}"><h3>${escapeHtml(heading)}</h3>\n${innerHtml}\n</div>`;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

/**
 * Lesson Overview — constant text, no Claude call.
 * The "60-minute / two 30-minute sessions" tip is the entire body of this
 * section per the canonical InDesign reference.
 */
export function renderLessonOverview(): string {
  return `<p><em>Tip: This lesson is designed to fit within a 60-minute instructional period. It may be split into two 30-minute sessions if needed.</em></p>`;
}

export function renderMeasurableObjectives(data: MeasurableObjectivesData): string {
  const items = data.objectives
    .map((o) => `  <li>${escapeHtml(o.text)} (${escapeHtml(o.standardCode)})</li>`)
    .join("\n");
  return `<p>Students will be able to</p>\n<ul>\n${items}\n</ul>`;
}

/**
 * Standards — compact strand-grouped list (matches the FINAL InDesign
 * reference). Description text is pulled from elaStandards.ts so Claude never
 * has to repeat or paraphrase the official wording.
 */
export function renderStandards(data: StandardsData): string {
  const codeMap = new Map(ALL_STANDARDS.map((s) => [s.code, s] as const));
  const strandOrder = ["RL", "RI", "W", "L", "SL"] as const;
  const strandLabels: Record<(typeof strandOrder)[number], string> = {
    RL: "Reading Literature",
    RI: "Reading Informational Text",
    W: "Writing",
    L: "Language",
    SL: "Speaking and Listening",
  };

  const grouped: Record<string, Array<{ code: string; description: string; sections: string[] }>> = {};
  for (const item of data.standards) {
    const standard = codeMap.get(item.code);
    if (!standard) continue;
    const strand = standard.strand;
    if (!grouped[strand]) grouped[strand] = [];
    grouped[strand].push({
      code: item.code,
      description: standard.text,
      sections: item.lessonSections,
    });
  }

  const blocks = strandOrder
    .filter((s) => grouped[s] && grouped[s].length > 0)
    .map((strand) => {
      const items = grouped[strand]
        .map(
          (s) =>
            `  <li><strong>${escapeHtml(s.code)}</strong> — ${escapeHtml(s.description)}<br/><em>Used in: ${escapeHtml(s.sections.join(", "))}</em></li>`,
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
  <li>Chart paper or whiteboard for class discussions.</li>
  <li>Sticky notes for exit tickets.</li>
  <li>Pencils, crayons/markers for graphic organizers.</li>
</ul>`;
}

export function renderGetReadyToRead(data: GetReadyToReadData): string {
  const steps = data.implementationSteps
    .map((s) => `  <li>${escapeHtml(s)}</li>`)
    .join("\n");
  return `<p><strong>Quick-write prompt:</strong> "${escapeHtml(data.quickWritePrompt)}"</p>
<ol class="tg-impl-steps">
${steps}
</ol>
${tip("Connection tip", data.connectionTip)}`;
}

export function renderWordsToKnowMiniLesson(data: WordsToKnowMiniLessonData): string {
  const activities = `  <p>Introduce vocabulary by previewing each word in the context of the chapter. Walk through this worked example for one of this chapter's vocab words:</p>
  <ul>
    <li>Word: <em>${escapeHtml(data.workedWord)}</em></li>
    <li>Quote from chapter (p. ${data.workedPage}): "${escapeHtml(data.workedQuote)}"</li>
    <li>Context-clue strategy: ${escapeHtml(data.contextClueStrategy)}</li>
    <li>Student-friendly definition: ${escapeHtml(data.studentDefinition)}</li>
  </ul>`;

  const partner = `  <p>Pair students. Have them locate each remaining word in the chapter and discuss meaning using a sentence frame such as: "I think <em>[word]</em> means ___ because the text says ___."</p>`;

  const quickCheck = `  <ol>
    <li>Call on 2–3 pairs to share their definitions.</li>
    <li>Confirm or correct using the official definition.</li>
    <li>Add the word to the classroom word wall.</li>
  </ol>`;

  return `${subblock("Activities", activities)}
${subblock("Partner Practice", partner)}
${subblock("Quick Check", quickCheck)}
${tip("Vocabulary tip", data.vocabularyTip)}`;
}

export function renderGuidedReading(data: GuidedReadingData): string {
  const sections = data.sections
    .map((s, i) => {
      const questions = s.questions
        .map(
          (q) =>
            `    <li>${escapeHtml(q.text)} <span class="tg-qtype">[${escapeHtml(q.questionType)}]</span></li>`,
        )
        .join("\n");
      return `<div class="tg-gr-section">
  <h3>Section ${i + 1}: pages ${s.pageStart}–${s.pageEnd}</h3>
  <p><em>Read from "${escapeHtml(s.openingPhrase)}" through "${escapeHtml(s.closingPhrase)}".</em></p>
  <p><strong>Pause-point questions:</strong></p>
  <ol class="tg-pause-points">
${questions}
  </ol>
</div>`;
    })
    .join("\n");

  return `${sections}
${tip("Read-aloud tip", data.readAloudTip)}`;
}

export function renderThinkAboutTheStoryAnswers(data: ThinkAboutTheStoryAnswersData): string {
  const answers = data.answers
    .map(
      (a) => `<div class="tg-answer">
  <p><strong>Q:</strong> ${escapeHtml(a.question)}</p>
  <p><strong>A:</strong> ${escapeHtml(a.answer)} (p. ${a.page}).</p>
</div>`,
    )
    .join("\n");

  const inferentialBlock = subblock(
    "Inferential Thinking — deeper follow-ups",
    `  ${ordered(data.inferentialPrompts)}`,
    "tg-inferential",
  );

  const tieredBlock = subblock(
    "Tiered Discussion Prompts",
    `  <p><strong>Literal:</strong></p>
  ${bullets(data.tieredDiscussion.literal)}
  <p><strong>Inference:</strong></p>
  ${bullets(data.tieredDiscussion.inference)}
  <p><strong>Analysis:</strong></p>
  ${bullets(data.tieredDiscussion.analysis)}
  <p><strong>Evaluation:</strong></p>
  ${bullets(data.tieredDiscussion.evaluation)}`,
    "tg-tiered",
  );

  const analyticalBlock = subblock(
    "Analytical Thinking",
    `  ${bullets(data.analyticalThinking)}`,
    "tg-analytical",
  );

  const personalBlock = subblock(
    "Personal Connection",
    `  ${bullets(data.personalConnection)}`,
    "tg-personal",
  );

  return `${answers}
${inferentialBlock}
${tieredBlock}
${analyticalBlock}
${personalBlock}`;
}

function renderSupportPhases(phases: SupportPhases): string {
  return `  <p><strong>Before reading:</strong></p>
  ${bullets(phases.before)}
  <p><strong>During reading:</strong></p>
  ${bullets(phases.during)}
  <p><strong>After reading:</strong></p>
  ${bullets(phases.after)}`;
}

export function renderDifferentiatedSupports(data: DifferentiatedSupportsData): string {
  return `${subblock("Struggling Readers", renderSupportPhases(data.strugglingReaders), "tg-supports")}
${subblock("English Language Learners", renderSupportPhases(data.englishLanguageLearners), "tg-supports")}
${subblock("Advanced Students", renderSupportPhases(data.advancedStudents), "tg-supports")}`;
}

export function renderCommonStudentQuestions(data: CommonStudentQuestionsData): string {
  const items = data.questions
    .map((q) => {
      const pageRef = q.page != null ? ` (p. ${q.page})` : "";
      return `  <li>
    <p><strong>Q:</strong> ${escapeHtml(q.studentQ)}</p>
    <p><strong>A:</strong> ${escapeHtml(q.teacherA)}${pageRef}</p>
  </li>`;
    })
    .join("\n");
  return `<ol class="tg-csq">
${items}
</ol>`;
}

/**
 * Five fixed error headings, in canonical order. Claude never controls these.
 * Only the body of each error (paragraph, weak example, how-to-fix) comes
 * from Claude. Weak examples and how-to-fix were suppressed in the previous
 * implementation because the validator counted exactly five <h4> headings —
 * any extra heading caused a crash. Restored here using bullet lists instead.
 */
export function renderCreativeResponseErrors(data: CreativeResponseErrorsData): string {
  const retellingHeading = `Retelling The Whole Chapter Instead of Focusing on ${data.characterName}'s Experience`;

  const renderError = (heading: string, body: { paragraph: string; weakExample: string; howToFix: string }): string => {
    return `  <div class="tg-error">
    <h4>${escapeHtml(heading)}</h4>
    <p>${escapeHtml(body.paragraph)}</p>
    <ul>
      <li><strong>Weak example:</strong> ${escapeHtml(body.weakExample)}</li>
      <li><strong>How to fix:</strong> ${escapeHtml(body.howToFix)}</li>
    </ul>
  </div>`;
  };

  return `<div class="tg-common-errors">
${renderError("No Specific Details From The Chapter", data.errors.noSpecificDetails)}
${renderError("Breaking Character", data.errors.breakingCharacter)}
${renderError(retellingHeading, data.errors.retelling)}
${renderError("No Evidence From the Text", data.errors.noEvidence)}
${renderError("Modern Language That Doesn't Fit The Story", data.errors.modernLanguage)}
</div>`;
}

export function renderExitTicket(data: ExitTicketData): string {
  const promptBlock = subblock("Prompt", `  <p>${escapeHtml(data.prompt)}</p>`);
  const criteriaBlock = subblock(
    "Success Criteria",
    `  ${bullets(data.successCriteria)}`,
  );
  const examplesBlock = subblock(
    "Example Responses",
    `  <ol>
    <li><strong>Strong:</strong> ${escapeHtml(data.strongExample)}</li>
    <li><strong>Developing:</strong> ${escapeHtml(data.developingExample)}</li>
  </ol>`,
  );
  return `${promptBlock}
${criteriaBlock}
${examplesBlock}`;
}

export function renderAnswerKey(data: AnswerKeyData): string {
  const qaList = (items: Array<{ question: string; answer: string; page: number }>): string => {
    if (items.length === 0) return `  <p><em>No questions to answer in this section.</em></p>`;
    const lis = items
      .map(
        (a) =>
          `    <li><strong>Q:</strong> ${escapeHtml(a.question)}<br/><strong>A:</strong> ${escapeHtml(a.answer)} (p. ${a.page}).</li>`,
      )
      .join("\n");
    return `  <ol>\n${lis}\n  </ol>`;
  };

  const rblBlock = subblock("Reading Between the Lines — Answers", qaList(data.readingBetweenTheLines));
  const ddBlock = subblock("Dig Deeper — Answers", qaList(data.digDeeper));

  const mcLis = data.multipleChoice
    .map(
      (a) =>
        `    <li><strong>Q:</strong> ${escapeHtml(a.question)}<br/><strong>Correct: ${escapeHtml(a.correctLetter)}</strong> — ${escapeHtml(a.rationale)}</li>`,
    )
    .join("\n");
  const mcBlock = subblock(
    "Multiple Choice — Answers",
    `  <ol>\n${mcLis || "    <li><em>No multiple choice questions.</em></li>"}\n  </ol>`,
  );

  const evidenceLis = data.evidenceFromTheStory
    .map(
      (a) =>
        `    <li><strong>Q:</strong> ${escapeHtml(a.question)}<br/><strong>Sample answer:</strong> ${escapeHtml(a.sampleAnswer)} ("${escapeHtml(a.quote)}", p. ${a.page})</li>`,
    )
    .join("\n");
  const evidenceBlock = subblock(
    "Evidence from the Story — Sample Answers",
    `  <ol>\n${evidenceLis || "    <li><em>No evidence questions.</em></li>"}\n  </ol>`,
  );

  const charRows = data.characterChart
    .map(
      (c) =>
        `      <tr><td>${escapeHtml(c.characterName)}</td><td>${escapeHtml(c.description)}</td><td>${escapeHtml(c.whatThisShows)}</td><td>"${escapeHtml(c.quote)}" (p. ${c.page})</td></tr>`,
    )
    .join("\n");
  const charTable = `  <table class="tg-character-key">
    <thead><tr><th>Character</th><th>Description / Actions</th><th>What This Shows</th><th>Evidence (quote + page)</th></tr></thead>
    <tbody>
${charRows || `      <tr><td colspan="4"><em>No characters in this chapter's chart.</em></td></tr>`}
    </tbody>
  </table>`;
  const charBlock = subblock("Character Chart — Answer Key", charTable);

  const drawBlock = subblock("Draw It! — Suggested Details", `  ${bullets(data.drawItDetails)}`);

  return `${rblBlock}
${ddBlock}
${mcBlock}
${evidenceBlock}
${charBlock}
${drawBlock}`;
}
