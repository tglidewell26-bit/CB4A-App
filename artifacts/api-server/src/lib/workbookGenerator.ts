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
    .map((entry, index) => `${index + 1}. ${entry.word} | lemma=${entry.lemma} | p.${entry.page_number} | quote="${entry.book_quote}"`)
    .join("\n");
}

export async function generateStudentWorkbook(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);

 const systemPrompt = `You are a curriculum specialist creating a CB4A Student Workbook in markdown.

Rules:
1) Use ONLY chapter text; no outside knowledge.
2) Grade ${meta.grade} guidance: ${guidance}
3) Output markdown only.
4) Keep this exact section order:
[Get Ready to Read] [Words to Know] [Think About the Story] [Reading Between the Lines] [Dig Deeper] [Multiple Choice] [Evidence from the Story] [Creative Response] [Writing Rubric] [Character Chart] [Draw It] [Reflect on Your Drawing] [Bonus Challenge] [Thinking Deeper]
5) Vocabulary must use exact input words and quotes. In Words to Know table, Definition and My Own Sentence must be blank cells.
6) All generated prompts/questions/answers must include page citations tied to chapter text.
7) Generate EXACTLY 6 "Think About the Story" comprehension questions.
8) Generate EXACTLY 3 "Reading Between the Lines" inference questions.
9) Generate EXACTLY 3 "Dig Deeper" analysis questions.
10) Generate EXACTLY 3 "Multiple Choice" questions.
11) Generate EXACTLY 3 "Evidence from the Story" short-answer questions.
12) Creative Response must be LETTER format (not diary) with salutation "Dear Deta," and closing "Sincerely,\n\nHeidi".
13) Generate EXACTLY 3 creative scaffolding hints in the Creative Response section.
14) Character Chart must include EXACTLY 5 character names.
15) Reflect on Your Drawing must include EXACTLY 3 reflection stems.
16) Bonus Challenge must include EXACTLY 7 timeline events.
17) Never use emojis or icon symbols anywhere in output.
18) Use plain bracket section headers only (example: [Get Ready to Read]) with no numbering.
19) "Words to Know" must include this exact 3-column markdown table header and separator:
| Word | Definition | My Own Sentence |
|---|---|---|
and every row must leave Definition and My Own Sentence blank.`;

  const userPrompt = `Book: ${meta.bookTitle}\nAuthor: ${meta.author}\nChapter: ${meta.chapterNum ? `${meta.chapterNum} — ` : ""}${meta.chapterTitle}\nPages: ${meta.pages}\nGrade: ${meta.grade}\n
Vocabulary (pre-computed; must use exactly):\n${serializeVocabulary(vocabulary)}\n
Chapter text:\n${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

export async function generateTeacherGuide(
  meta: ChapterMeta,
  studentWorkbookMarkdown: string,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);

  const systemPrompt = `You are a curriculum specialist creating a CB4A Teacher Guide in markdown.

Rules:
1) Use ONLY chapter text and provided student workbook.
2) Grade ${meta.grade} guidance: ${guidance}
3) Output markdown only.
4) Mirror the student workbook structure exactly.
5) Use exact same vocabulary and exact same student questions from the input student workbook.
6) "Words to Know" must use this exact 4-column markdown table:
| Word | Definition | Example Sentence | Part of Speech |
|---|---|---|---|
All 4 columns must be filled for each vocabulary word.
7) Generate only teacher-facing content: answers with page citations, teaching tips, misconceptions, differentiation, guided reading, tiered discussion.
8) Use this exact section order:
[Lesson Overview] [Get Ready to Read] [Words to Know] [Guided Reading] [Think About the Story + Tiered Discussion] [Reading Between the Lines + answers] [Dig Deeper + answers] [Multiple Choice + answers] [Evidence from Story + answers] [Creative Response Guide] [Character Chart Answer Key] [Draw It + Reflect answers] [Bonus Challenge answers] [Thinking Deeper + Exit Ticket]
9) Never use emojis or icon symbols anywhere in output.
10) Use plain bracket section headers only with no numbering or extra decoration.`;

  const userPrompt = `Book: ${meta.bookTitle}\nAuthor: ${meta.author}\nChapter: ${meta.chapterNum ? `${meta.chapterNum} — ` : ""}${meta.chapterTitle}\nPages: ${meta.pages}\nGrade: ${meta.grade}\n
Pre-computed vocabulary (must remain unchanged words):\n${serializeVocabulary(vocabulary)}\n
Student workbook markdown (source of truth for sections/questions):\n${studentWorkbookMarkdown}\n
Chapter text:\n${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
