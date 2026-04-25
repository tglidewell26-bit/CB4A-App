import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { VocabularyWord } from "./vocabularyExtractor.js";

const GRADE_GUIDANCE: Record<number, string> = {
  3: "Grade 3: very simple vocabulary, short sentences, and concrete thinking.",
  4: "Grade 4: clear language and a mix of literal + light inference.",
  5: "Grade 5: increasingly inferential and evidence-focused.",
  6: "Grade 6: stronger analysis and close-reading language.",
  7: "Grade 7: literary analysis, theme, and character motivation.",
  8: "Grade 8: nuanced analysis, author craft, and thematic depth.",
};

interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
}

function truncateText(text: string, maxChars = 80000): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Text truncated for length]`;
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary
    .map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`)
    .join("\n");
}

function buildWordsToKnowTableHtml(vocabulary: VocabularyWord[]): string {
  const rows = vocabulary
    .map(
      (v) => `<tr>
  <td>${v.word}</td>
  <td>__________________________________________</td>
  <td>"${v.book_quote}" (p.${v.page_number})</td>
  <td>__________________________________________</td>
</tr>`,
    )
    .join("\n");

  return `<table class="rubric-table">
  <thead>
    <tr>
      <th>Word</th>
      <th>Definition using context clues</th>
      <th>Sentence from book with page number</th>
      <th>My own sentence</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`;
}

function answerLines(count = 3): string {
  return Array(count).fill('<div class="answer-space"></div>').join("\n");
}

function stripLeadingQuestionNumbers(html: string): string {
  return html.replace(
    /(<div class="question">\s*)(\d+\s*[\.\)]\s*)+/g,
    "$1",
  );
}

export async function generateStudentWorkbook(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;

  const wordsToKnowTableHtml = buildWordsToKnowTableHtml(vocabulary);

  const systemPrompt = `You are a curriculum specialist creating a CB4A Student Workbook as an HTML fragment.

Output ONLY the inner HTML — no <!DOCTYPE>, no <html>, no <head>, no <body> tags.
Start your output with: <div class="workbook">
End your output with: </div>

Use EXACTLY these CSS class names (they are pre-styled):
  Sections:        <div class="wb-section"><h2>Section Title</h2>...</div>
  Instructions:    <p class="wb-instructions">...</p>
  Focus box:       <div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>
  Words table:     WORDS_TO_KNOW_TABLE_PLACEHOLDER
  Questions (numbered): <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol>
  MC question:     <div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div>
  Short answer:    <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol>
  Creative hints:  <ul class="hints"><li>...</li></ul>
  Writing space:   <div class="writing-space"></div>
  Timeline:        <ol class="timeline-list"><li>...</li></ol>
  Character table: <table class="rubric-table"><thead>...</thead><tbody>...</tbody></table>
  Rubric table:    <table class="rubric-table">...</table>

RULES:
1) Use ONLY chapter text — no outside knowledge.
2) ${guidance}
3) Sections in this EXACT order: Get Ready to Read · Words to Know · Think About the Story · Reading Between the Lines · Dig Deeper · Multiple Choice · Evidence from the Story · Creative Response · Rubric · Character Chart · Draw It · Reflection · Bonus Challenge · Prediction
4) Generate EXACTLY: 6 Think About the Story, 3 Reading Between the Lines, 3 Dig Deeper, 3 Multiple Choice, 3 Evidence from the Story questions.
5) All questions must cite page numbers from the chapter.
6) Words to Know: DO NOT generate definitions/examples. Insert WORDS_TO_KNOW_TABLE_PLACEHOLDER exactly, unchanged.
7) Creative Response must be a LETTER prompt to Deta from Heidi with EXACTLY 3 hint bullet points, followed by a writing space.
8) Rubric must be a checklist table with exactly these 4 criteria rows:
   - I answered the prompt
   - I included details from Chapter 1
   - I wrote in Heidi's voice
   - I checked my spelling and grammar
9) Character Chart must have exactly 5 rows with columns:
   - Character Name
   - What They Look Like and How They Act
   - What This Shows About Them
10) Draw It must tell students to draw Heidi climbing the mountain with Peter and the goats.
11) Reflection must include exactly 3 sentence stems to reflect on the drawing.
12) Bonus Challenge must be "Follow the Story": provide exactly 7 scrambled events for students to number 1–7.
13) Prediction must ask what the reader predicts will happen next.
14) Never use emojis.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words (pre-extracted — use these exact words and quotes):
${serializeVocabulary(vocabulary)}

Chapter text:
${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  let html = block.type === "text" ? block.text : "";

  // Inject the pre-built Words to Know student-fillable chart.
  html = html.replace("WORDS_TO_KNOW_TABLE_PLACEHOLDER", wordsToKnowTableHtml);

  // Wrap with header block
  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Student Workbook</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  html = html.replace('<div class="workbook">', `<div class="workbook">\n${headerHtml}`);
  html = stripLeadingQuestionNumbers(html);

  return html;
}

export async function generateTeacherGuide(
  meta: ChapterMeta,
  studentWorkbookHtml: string,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;

  const systemPrompt = `You are a curriculum specialist creating a CB4A Teacher Guide as an HTML fragment.

Output ONLY the inner HTML — no <!DOCTYPE>, no <html>, no <head>, no <body> tags.
Start your output with: <div class="teacher-guide">
End your output with: </div>

Use EXACTLY these CSS class names (they are pre-styled):
  Sections:        <div class="tg-section"><h2>Section Title</h2>...</div>
  Instructions:    <p class="tg-instructions">...</p>
  Answers:         <div class="answer-item"><div class="question">Q: ...</div><div class="answer">A: ...</div></div>
  Tips:            <div class="discussion-note">Teaching tip: ...</div>
  Vocab table:     <table class="rubric-table"><thead><tr><th>Word</th><th>Definition</th><th>Example Sentence</th><th>Part of Speech</th></tr></thead><tbody>...</tbody></table>
  Diff grid:       <div class="diff-grid"><div class="diff-card"><h3>Approaching</h3>...</div><div class="diff-card"><h3>On Level</h3>...</div><div class="diff-card"><h3>Advanced</h3>...</div></div>
  MC answers:      <ol><li>Correct answer: [letter]. [Explanation with page cite]</li></ol>

RULES:
1) Mirror the student workbook structure exactly — same sections, same questions.
2) ${guidance}
3) Sections in this EXACT order: Lesson Overview · Standards · Measurable Objectives · Get Ready to Read · Words to Know mini-lesson · Guided Reading with pause points · Tiered Discussion · Answers aligned to workbook pages · Struggling Readers / ELL / Advanced Students support · Common student questions · Creative Response common errors · Teacher notes
4) For every student question: provide a model answer with page citations.
5) Standards section must include this exact Grade 3 standards list when grade = 3: RL.3.1, RL.3.3, RL.3.4, L.3.4, L.3.5, SL.3.1, SL.3.3, W.3.3.
6) Words to Know mini-lesson should explain how students infer meaning from context without giving away answers.
7) Answers aligned to workbook pages must keep section names exactly matched to the workbook.
8) Struggling Readers / ELL / Advanced Students support must include one actionable support for each group.
9) Never use emojis.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words:
${serializeVocabulary(vocabulary)}

Student workbook (HTML — source of truth for questions):
${studentWorkbookHtml}

Chapter text:
${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  let html = block.type === "text" ? block.text : "";

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Teacher Guide</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  html = html.replace('<div class="teacher-guide">', `<div class="teacher-guide">\n${headerHtml}`);

  return html;
}
