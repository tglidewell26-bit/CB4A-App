import * as fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { VocabularyWord } from "./vocabularyExtractor.js";

interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
}

type WorkbookStructured = Record<string, unknown>;
type TeacherStructured = Record<string, unknown>;

function sanitizeName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

function truncateText(text: string, maxChars = 80000): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Text truncated for length]`;
}

async function generateStructuredWorkbook(meta: ChapterMeta, vocabulary: VocabularyWord[]): Promise<WorkbookStructured> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: `You create structured JSON for a Grade ${meta.grade} student workbook. Return ONLY JSON object with keys matching this schema:
{
  "focus_question": "string",
  "basic_comprehension": [{"QUESTION":"...","ANSWER":"..."}],
  "inference_questions": [{"QUESTION":"...","ANSWER":"..."}],
  "analysis_questions": [{"QUESTION":"...","ANSWER":"..."}],
  "multiple_choice": [{"QUESTION":"...","OPTION_A":"...","OPTION_B":"...","OPTION_C":"...","OPTION_D":"...","CORRECT_ANSWER":"A"}],
  "short_answer": [{"QUESTION":"...","ANSWER":"..."}],
  "creative_response": {"PROMPT":"...","HINT_1":"...","HINT_2":"...","HINT_3":"..."},
  "writing_rubric": [
    {"CATEGORY":"Ideas","POINTS":"2","DESCRIPTION":"Does the response show creative thinking?"},
    {"CATEGORY":"Details from the Chapter","POINTS":"2","DESCRIPTION":"Does it use specific details?"},
    {"CATEGORY":"Writing Clarity","POINTS":"2","DESCRIPTION":"Is it clear and organized?"},
    {"CATEGORY":"Spelling/Grammar","POINTS":"2","DESCRIPTION":"Are there spelling/grammar errors?"}
  ],
  "timeline_events": ["..."],
  "character_chart": [{"CHARACTER":"...","TRAITS":"...","EVIDENCE":"..."}],
  "draw_it_prompt": "Draw what you imagine [scene/character] looks like. Use the description from the book to guide your drawing.",
  "reflect_stems": ["My drawing shows...","I chose these colors/details because...","This part of the story is important because..."],
  "thinking_deeper_question": "string"
}
Rules:
- Use chapter evidence only and keep the Classic Books for All section design.
- 6 basic_comprehension, 3 inference, 3 analysis, 3 multiple_choice, 3 short_answer.
- timeline_events must contain exactly 7 key chapter events in SCRAMBLED order for a reordering activity.
- 5 character_chart rows.
- 3 reflect_stems exactly as shown in schema.
- focus_question is ONE question for "Get Ready to Read" and should fit inside a shaded prompt box (no answer lines).
- short_answer should be written for the "Evidence from the Story" section and require complete sentences with page evidence.
- creative_response prompt must be in letter format: "Dear [character], ... Sincerely, [Student]".
- creative_response must include exactly 3 helpful hint bullets.
- Never include markdown fences.`,
    messages: [{
      role: "user",
      content: `Meta: ${JSON.stringify(meta)}\nVocabulary:\n${JSON.stringify(vocabulary, null, 2)}\nChapter:\n${truncateText(meta.extractedText)}`,
    }],
  });

  const text = message.content.find((block: { type: string }) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude returned no structured workbook text");
  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Unable to parse workbook JSON response");
  return JSON.parse(jsonMatch[0]) as WorkbookStructured;
}

async function generateStructuredTeacherGuide(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
  workbook: WorkbookStructured,
): Promise<TeacherStructured> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: `You create structured JSON for a teacher guide. Return only JSON with keys:
lesson_overview, measurable_objectives, standards_list, materials_needed, get_ready_to_read,
vocab_intro, vocab_partner_practice, vocab_quick_check,
vocab_diff_struggling, vocab_diff_ell, vocab_diff_advanced,
guided_sections (array with SECTION_NUMBER,PAGE_RANGE,READ_FROM,READ_TO,PAUSE_QUESTIONS),
guided_tip,guided_diff_struggling,guided_diff_ell,guided_diff_advanced,
tiered_level_1,tiered_level_2,tiered_level_3,tiered_level_4,tiered_management,
think_about_answers,reading_between_answers,dig_deeper_answers,multiple_choice_answers,short_answer_answers,
creative_response_guide,character_chart_answer_key,timeline_answer_key,exit_ticket_guide,differentiation_summary.
Use workbook questions as source of truth.` ,
    messages: [{
      role: "user",
      content: `Meta: ${JSON.stringify(meta)}\nVocabulary:\n${JSON.stringify(vocabulary, null, 2)}\nWorkbook JSON:\n${JSON.stringify(workbook, null, 2)}\nChapter:\n${truncateText(meta.extractedText)}`,
    }],
  });

  const text = message.content.find((block: { type: string }) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude returned no structured teacher guide text");
  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Unable to parse teacher guide JSON response");
  return JSON.parse(jsonMatch[0]) as TeacherStructured;
}

async function runPythonDocBuilder(payload: {
  template: "workbook" | "teacher";
  meta: ChapterMeta;
  grade: number;
  vocabulary: VocabularyWord[];
  generated: Record<string, unknown>;
  outputPath: string;
}): Promise<void> {
  const bridgePath = path.resolve(process.cwd(), "../../docx_pipeline_bridge.py");
  await fs.promises.mkdir(path.dirname(payload.outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("python3", [bridgePath], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`python doc builder failed (${code}): ${stderr}`));
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export async function generateStudentWorkbook(meta: ChapterMeta, vocabulary: VocabularyWord[]): Promise<{ outputPath: string; structured: WorkbookStructured; }> {
  const structured = await generateStructuredWorkbook(meta, vocabulary);
  const fileName = `StudentWorkbook_${sanitizeName(meta.bookTitle)}_Grade${meta.grade}.docx`;
  const outputPath = path.resolve(process.cwd(), `../../outputs/docx/${fileName}`);

  await runPythonDocBuilder({
    template: "workbook",
    meta,
    grade: meta.grade,
    vocabulary,
    generated: structured,
    outputPath,
  });

  return { outputPath, structured };
}

export async function generateTeacherGuide(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
  workbookStructured: WorkbookStructured,
): Promise<{ outputPath: string; structured: TeacherStructured; }> {
  const structured = await generateStructuredTeacherGuide(meta, vocabulary, workbookStructured);
  const fileName = `TeacherGuide_${sanitizeName(meta.bookTitle)}_Grade${meta.grade}.docx`;
  const outputPath = path.resolve(process.cwd(), `../../outputs/docx/${fileName}`);

  await runPythonDocBuilder({
    template: "teacher",
    meta,
    grade: meta.grade,
    vocabulary,
    generated: structured,
    outputPath,
  });

  return { outputPath, structured };
}
