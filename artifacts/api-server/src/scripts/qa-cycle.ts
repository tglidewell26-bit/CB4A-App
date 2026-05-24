/**
 * Multi-cycle QA driver for the chapter generation pipeline.
 *
 * For each cycle, this script:
 *   1. POSTs to the existing /regenerate endpoint for a target chapter.
 *   2. Polls the chapter detail endpoint until status leaves "generating".
 *   3. Pulls the rendered Student Workbook + Teacher Guide HTML.
 *   4. Runs structural alignment checks between the two:
 *        - Workbook contains the expected counts of items per core section.
 *        - Each core question section's question text appears in the workbook.
 *        - The focus question from the workbook appears in the teacher guide
 *          quick-write block.
 *        - The teacher guide answer key is present and non-empty.
 *   5. Persists workbook.html, teacher-guide.html, and a JSON discrepancy
 *      report under /tmp/qa-runs/run-N/.
 *
 * Notes:
 *   - This script intentionally adds no new generation logic. The in-pipeline
 *     validators (validateAnswerKeyQuestionsMatchHtml,
 *     validateMultipleChoiceAnswerLetters, validateSections) already enforce
 *     question/answer alignment server-side and will surface as
 *     `status === "error"` with a populated `errorMessage`. This driver only
 *     adds rendered-HTML structural sanity checks on top.
 *   - Run with: pnpm --filter @workspace/api-server tsx src/scripts/qa-cycle.ts
 *     Optional env vars: API_BASE (default http://localhost:8080),
 *     QA_BOOK_ID (default 59), QA_CHAPTER_ID (default 71), QA_CYCLES (default 5).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API_BASE = process.env.API_BASE ?? "http://localhost:8080";
const BOOK_ID = Number(process.env.QA_BOOK_ID ?? "59");
const CHAPTER_ID = Number(process.env.QA_CHAPTER_ID ?? "71");
const CYCLES = Number(process.env.QA_CYCLES ?? "5");
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * Per-section item counts scale with the number of book chapters in a lesson.
 * Override at runtime via QA_CHAPTER_COUNT (default 1 — single-chapter lesson).
 *   - think_about_the_story          : fixed 6
 *   - reading_between_the_lines, MC  : 3 × chapterCount
 *   - dig_deeper, evidence_from_story: 3 + 2·(chapterCount − 1)
 */
const QA_CHAPTER_COUNT = Math.max(1, Number(process.env.QA_CHAPTER_COUNT ?? "1"));

const EXPECTED_WORKBOOK_ITEM_COUNTS: Record<string, number> = (() => {
  const cc = QA_CHAPTER_COUNT;
  return {
    think_about_the_story: 6,
    reading_between_the_lines: 3 * cc,
    dig_deeper: 3 + 2 * (cc - 1),
    multiple_choice_questions: 3 * cc,
    evidence_from_the_story: 3 + 2 * (cc - 1),
  };
})();

const CORE_QUESTION_SECTION_KEYS = Object.keys(EXPECTED_WORKBOOK_ITEM_COUNTS);

interface ChapterResponse {
  id: number;
  status: "ready" | "generating" | "error" | string;
  hasWorkbook: boolean;
  hasTeacherGuide: boolean;
  errorMessage: string | null;
}

interface CycleReport {
  cycle: number;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  status: string;
  errorMessage: string | null;
  discrepancies: string[];
  workbookSectionCounts: Record<string, number>;
  questionsInBothSection: Record<string, { workbook: number; matchedInTg: number }>;
  focusQuestion: string | null;
  focusQuestionInTeacherGuide: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChapter(): Promise<ChapterResponse> {
  const res = await fetch(`${API_BASE}/api/books/${BOOK_ID}/chapters`);
  if (!res.ok) throw new Error(`GET chapters failed: ${res.status}`);
  const list = (await res.json()) as ChapterResponse[];
  const chapter = list.find((c) => c.id === CHAPTER_ID);
  if (!chapter) throw new Error(`Chapter ${CHAPTER_ID} not found in book ${BOOK_ID}`);
  return chapter;
}

async function triggerRegenerate(): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/books/${BOOK_ID}/chapters/${CHAPTER_ID}/regenerate`,
    { method: "POST" },
  );
  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`Regenerate failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function pollUntilDone(): Promise<ChapterResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const chapter = await fetchChapter();
    if (chapter.status !== "generating") return chapter;
  }
  throw new Error(`Polling timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function fetchHtml(kind: "workbook" | "teacher-guide"): Promise<string> {
  const res = await fetch(`${API_BASE}/api/books/${BOOK_ID}/chapters/${CHAPTER_ID}/${kind}`);
  if (!res.ok) throw new Error(`GET ${kind} failed: ${res.status}`);
  const data = (await res.json()) as { content: string };
  return data.content;
}

/** Extracts a single section's body HTML from the rendered workbook. */
function extractWorkbookSection(workbookHtml: string, sectionKey: string): string {
  const re = new RegExp(
    `<div class="wb-section" data-section-key="${sectionKey}">([\\s\\S]*?)</div>\\s*(?=<div class="wb-section"|</div>\\s*$)`,
    "m",
  );
  const m = workbookHtml.match(re);
  return m?.[1] ?? "";
}

/** Counts items per core question section in the rendered workbook HTML. */
function countWorkbookItems(workbookHtml: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of CORE_QUESTION_SECTION_KEYS) {
    const sectionHtml = extractWorkbookSection(workbookHtml, key);
    if (key === "multiple_choice_questions") {
      counts[key] = (sectionHtml.match(/<div[^>]*class="[^"]*\bmc-item\b[^"]*"/g) ?? []).length;
    } else {
      counts[key] = (sectionHtml.match(/<li[\s>]/g) ?? []).length;
    }
  }
  return counts;
}

/** Returns ordered, normalized question texts from a workbook section. */
function extractQuestionTexts(sectionHtml: string): string[] {
  const matches = sectionHtml.matchAll(/<div class="question">([\s\S]*?)<\/div>/g);
  const out: string[] = [];
  for (const m of matches) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

/**
 * Normalizes question text for cross-document substring matching: decodes the
 * common HTML entities the renderer escapes (apostrophes, ampersands, quotes,
 * angle brackets, non-breaking spaces, plus numeric character refs), collapses
 * whitespace, lowercases. The Teacher Guide HTML escapes apostrophes as &#39;
 * while the Student Workbook stores question text raw, so an unencoded
 * substring search on the rendered TG would miss any question containing a
 * possessive or contraction. The in-pipeline validator
 * `validateAnswerKeyQuestionsMatchHtml` operates on pre-render strings and so
 * is unaffected — this normalization only matters for post-render diffing.
 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalize(s: string): string {
  return decodeHtmlEntities(s).replace(/\s+/g, " ").trim().toLowerCase();
}

function extractFocusQuestion(workbookHtml: string): string | null {
  const m = workbookHtml.match(/<div class="focus-question">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, "").trim();
  return text || null;
}

function compareWorkbookAndTeacherGuide(
  workbookHtml: string,
  teacherGuideHtml: string,
): Pick<
  CycleReport,
  "discrepancies" | "workbookSectionCounts" | "questionsInBothSection" | "focusQuestion" | "focusQuestionInTeacherGuide"
> {
  const discrepancies: string[] = [];

  const counts = countWorkbookItems(workbookHtml);
  for (const [key, expected] of Object.entries(EXPECTED_WORKBOOK_ITEM_COUNTS)) {
    if (counts[key] !== expected) {
      discrepancies.push(
        `Workbook section "${key}" has ${counts[key]} items, expected ${expected}.`,
      );
    }
  }

  const questionsInBothSection: Record<string, { workbook: number; matchedInTg: number }> = {};
  const tgNormalized = normalize(teacherGuideHtml);
  for (const key of CORE_QUESTION_SECTION_KEYS) {
    const sectionHtml = extractWorkbookSection(workbookHtml, key);
    const questions = extractQuestionTexts(sectionHtml);
    let matched = 0;
    for (const q of questions) {
      if (tgNormalized.includes(normalize(q))) matched++;
    }
    questionsInBothSection[key] = { workbook: questions.length, matchedInTg: matched };
    // All five core question sections (TATS via think_about_the_story_answers,
    // plus RBTL, DD, MC, ETS via the answer key) must have every workbook
    // question appear verbatim in the TG. MC was previously excluded; the MC
    // stem is what wraps the rendered <div class="mc-item"> letter choices in
    // the TG answer key, so it must be present too. Failing to enforce this
    // lets MC drift go undetected.
    if (questions.length > 0 && matched < questions.length) {
      discrepancies.push(
        `Section "${key}": only ${matched}/${questions.length} workbook questions found verbatim in teacher guide.`,
      );
    }
  }

  const focusQuestion = extractFocusQuestion(workbookHtml);
  let focusQuestionInTeacherGuide = false;
  if (focusQuestion) {
    focusQuestionInTeacherGuide = normalize(teacherGuideHtml).includes(normalize(focusQuestion));
    if (!focusQuestionInTeacherGuide) {
      discrepancies.push(
        `Focus question "${focusQuestion.slice(0, 80)}..." not found in teacher guide.`,
      );
    }
  } else {
    discrepancies.push("Workbook is missing a focus question in get_ready_to_read.");
  }

  if (!/class="tg-answer-key"/.test(teacherGuideHtml)) {
    discrepancies.push("Teacher guide is missing the tg-answer-key block.");
  }
  if (!/class="tg-tats-answers"/.test(teacherGuideHtml)) {
    discrepancies.push("Teacher guide is missing the tg-tats-answers block.");
  }

  return {
    discrepancies,
    workbookSectionCounts: counts,
    questionsInBothSection,
    focusQuestion,
    focusQuestionInTeacherGuide,
  };
}

async function runCycle(cycle: number, outRoot: string, skipTrigger: boolean): Promise<CycleReport> {
  const startedAt = new Date();
  console.log(`\n=== Cycle ${cycle}/${CYCLES} starting at ${startedAt.toISOString()} (skipTrigger=${skipTrigger}) ===`);

  let final: ChapterResponse;
  if (skipTrigger) {
    const initial = await fetchChapter();
    if (initial.status === "generating") {
      console.log("Waiting for in-flight generation to finish...");
      final = await pollUntilDone();
    } else {
      final = initial;
    }
  } else {
    const initial = await fetchChapter();
    if (initial.status === "generating") {
      console.log("Chapter already generating from a prior run — waiting for it to finish first.");
      await pollUntilDone();
    }
    await triggerRegenerate();
    console.log("Regenerate triggered. Polling for completion...");
    final = await pollUntilDone();
  }

  const finishedAt = new Date();
  const durationSec = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
  console.log(
    `Cycle ${cycle} finished in ${durationSec}s with status="${final.status}"`,
    final.errorMessage ? `errorMessage="${final.errorMessage}"` : "",
  );

  const report: CycleReport = {
    cycle,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSec,
    status: final.status,
    errorMessage: final.errorMessage,
    discrepancies: [],
    workbookSectionCounts: {},
    questionsInBothSection: {},
    focusQuestion: null,
    focusQuestionInTeacherGuide: false,
  };

  const cycleDir = join(outRoot, `run-${cycle}`);
  await mkdir(cycleDir, { recursive: true });

  if (final.status === "ready" && final.hasWorkbook && final.hasTeacherGuide) {
    const [workbookHtml, teacherGuideHtml] = await Promise.all([
      fetchHtml("workbook"),
      fetchHtml("teacher-guide"),
    ]);
    await writeFile(join(cycleDir, "workbook.html"), workbookHtml);
    await writeFile(join(cycleDir, "teacher-guide.html"), teacherGuideHtml);
    Object.assign(report, compareWorkbookAndTeacherGuide(workbookHtml, teacherGuideHtml));
  } else {
    report.discrepancies.push(
      `Generation did not complete cleanly (status=${final.status}, hasWorkbook=${final.hasWorkbook}, hasTeacherGuide=${final.hasTeacherGuide}).`,
    );
  }

  await writeFile(join(cycleDir, "report.json"), JSON.stringify(report, null, 2));

  if (report.discrepancies.length === 0) {
    console.log(`Cycle ${cycle}: PASS (no discrepancies).`);
  } else {
    console.log(`Cycle ${cycle}: FAIL — ${report.discrepancies.length} discrepancies:`);
    for (const d of report.discrepancies) console.log("  - " + d);
  }
  return report;
}

async function main() {
  const outRoot = `/tmp/qa-runs/${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(outRoot, { recursive: true });
  console.log(`QA cycle run output → ${outRoot}`);
  console.log(`API_BASE=${API_BASE} BOOK_ID=${BOOK_ID} CHAPTER_ID=${CHAPTER_ID} CYCLES=${CYCLES}`);

  const skipTrigger = process.env.QA_SKIP_TRIGGER === "1";
  const reports: CycleReport[] = [];
  for (let i = 1; i <= CYCLES; i++) {
    try {
      reports.push(await runCycle(i, outRoot, skipTrigger));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Cycle ${i} threw: ${message}`);
      reports.push({
        cycle: i,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationSec: 0,
        status: "driver-error",
        errorMessage: message,
        discrepancies: [`Driver error: ${message}`],
        workbookSectionCounts: {},
        questionsInBothSection: {},
        focusQuestion: null,
        focusQuestionInTeacherGuide: false,
      });
    }
  }

  const summary = {
    cycles: reports.length,
    passed: reports.filter((r) => r.discrepancies.length === 0 && r.status === "ready").length,
    failed: reports.filter((r) => r.discrepancies.length > 0 || r.status !== "ready").length,
    reports,
  };
  await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`Cycles: ${summary.cycles}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
  for (const r of reports) {
    console.log(
      `  Cycle ${r.cycle}: ${r.discrepancies.length === 0 && r.status === "ready" ? "PASS" : "FAIL"} ` +
        `(status=${r.status}, ${r.discrepancies.length} discrepancies, ${r.durationSec}s)`,
    );
  }
  console.log(`Full output: ${outRoot}`);
  process.exit(summary.failed === 0 ? 0 : 1);
}

void main();
