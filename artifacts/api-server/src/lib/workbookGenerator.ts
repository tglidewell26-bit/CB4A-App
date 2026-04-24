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
  "guided_tip": "string",
  "guided_sections": [{"SECTION_NUMBER":"1","PAGE_RANGE":"p.1-2","PAUSE_QUESTIONS":"..."}],
  "basic_comprehension": [{"QUESTION":"...","ANSWER":"..."}],
  "inference_questions": [{"QUESTION":"...","ANSWER":"..."}],
  "analysis_questions": [{"QUESTION":"...","ANSWER":"..."}],
  "multiple_choice": [{"QUESTION":"...","OPTION_A":"...","OPTION_B":"...","OPTION_C":"...","OPTION_D":"...","CORRECT_ANSWER":"A"}],
  "short_answer": [{"QUESTION":"...","ANSWER":"..."}],
  "creative_response": {"PROMPT":"...","HINT_1":"...","HINT_2":"...","HINT_3":"..."},
  "timeline_events": ["..."],
  "character_chart": [{"CHARACTER":"...","TRAITS":"...","EVIDENCE":"..."}],
  "reflect_stems": ["..."],
  "bonus_challenge": "string"
}
Rules:
- Use chapter evidence only.
- 6 basic_comprehension, 3 inference, 3 analysis, 3 multiple_choice, 3 short_answer.
- 4 guided sections.
- 7 timeline events.
- 5 character_chart rows.
- 3 reflect_stems.
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
