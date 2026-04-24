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

function buildVocabCardsHtml(vocabulary: VocabularyWord[]): string {
  return vocabulary.map((v) => `
    <div class="vocab-item">
      <div class="vocab-word">${v.word}</div>
      <div class="vocab-quote">"${v.book_quote}" (p.${v.page_number})</div>
      <div class="vocab-def">Meaning: ${v.kid_friendly_definition ?? ""}</div>
      <div class="vocab-example">Example: ${v.example_sentence ?? ""}</div>
    </div>`).join("\n");
}

function answerLines(count = 3): string {
  return Array(count).fill('<div class="answer-space"></div>').join("\n");
}

export async function generateStudentWorkbook(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;

  const vocabCardsHtml = buildVocabCardsHtml(vocabulary);
  const hasEnrichment = vocabulary.some((v) => v.kid_friendly_definition);
  const vocabNote = hasEnrichment
    ? "The vocab card HTML (word, quote, meaning, example) is pre-built and injected — DO NOT re-generate vocabulary cards. Insert the VOCAB_CARDS_PLACEHOLDER exactly."
    : "Generate a kid-friendly Meaning and Example sentence for each vocabulary word provided.";

  const systemPrompt = `You are a curriculum specialist creating a CB4A Student Workbook as an HTML fragment.

${vocabNote}

Output ONLY the inner HTML — no <!DOCTYPE>, no <html>, no <head>, no <body> tags.
Start your output with: <div class="workbook">
End your output with: </div>

Use EXACTLY these CSS class names (they are pre-styled):
  Sections:        <div class="wb-section"><h2>Section Title</h2>...</div>
  Instructions:    <p class="wb-instructions">...</p>
  Focus box:       <div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>
  Vocab grid:      <div class="vocab-grid">VOCAB_CARDS_PLACEHOLDER</div>
  Questions (numbered): <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol>
  MC question:     <div class="mc-item"><div class="question">N. ...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div>
  Short answer:    <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol>
  Creative hints:  <ul class="hints"><li>...</li></ul>
  Writing space:   <div class="writing-space"></div>
  Timeline:        <ol class="timeline-list"><li>...</li></ol>
  Character table: <table class="rubric-table"><thead>...</thead><tbody>...</tbody></table>
  Rubric table:    <table class="rubric-table">...</table>

RULES:
1) Use ONLY chapter text — no outside knowledge.
2) ${guidance}
3) Sections in this EXACT order: Before You Read · Vocabulary · Basic Comprehension · Reading Between the Lines · Analysis Questions · Multiple Choice · Short Answer · Creative Response · Writing Rubric · Character Chart · Chapter Timeline · Thinking Deeper
4) Generate EXACTLY: 6 Basic Comprehension, 3 Reading Between the Lines, 3 Analysis, 3 Multiple Choice, 3 Short Answer questions.
5) All questions must cite page numbers from the chapter.
6) Creative Response: one writing prompt (letter, journal, or narrative) with EXACTLY 3 hint bullet points, followed by a large writing space.
7) Writing Rubric: a 4-row scoring table (scores 4, 3, 2, 1) explaining what each score means.
8) Character Chart: exactly 5 characters in a table with columns: Character | Role | One thing they do | One word to describe them.
9) Chapter Timeline: exactly 7 events in correct story order.
10) Thinking Deeper: one deep reflection question requiring 3+ sentence answer, with a large writing space.
11) Never use emojis.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words (pre-extracted — use these exact words and quotes):
${vocabulary.map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`).join("\n")}

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

  // Inject the pre-built vocab cards HTML
  html = html.replace("VOCAB_CARDS_PLACEHOLDER", vocabCardsHtml);

  // Wrap with header block
  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Student Workbook</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  html = html.replace('<div class="workbook">', `<div class="workbook">\n${headerHtml}`);

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
3) Sections in this EXACT order: Lesson Overview · Learning Objectives · Vocabulary Guide · Before You Read (teacher notes) · Basic Comprehension (answers) · Reading Between the Lines (answers) · Analysis Questions (answers) · Multiple Choice (answers) · Short Answer (answers) · Creative Response Guide · Character Chart Answer Key · Chapter Timeline Answer Key · Thinking Deeper (discussion guide) · Differentiation Strategies · Exit Ticket
4) For every student question: provide a model answer with page citations.
5) Vocabulary Guide: a table with Definition, Example Sentence, Part of Speech for each word.
6) Differentiation Strategies: a 3-column grid — Approaching, On Level, Advanced — for the main activities.
7) Exit Ticket: one formative assessment question with a model answer.
8) Never use emojis.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words:
${vocabulary.map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`).join("\n")}

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
