import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { VocabularyWord } from "./vocabularyExtractor.js";

const execFileAsync = promisify(execFile);

function getPythonCommand(): string {
  return process.env.PYTHON_BIN || "python";
}

function selectorPath(): string {
  return resolve(process.cwd(), "workbook_generator", "vocab_selector.py");
}

function enricherPath(): string {
  return resolve(process.cwd(), "workbook_generator", "vocab_enricher.py");
}

export async function selectAndEnrichVocabulary(
  extractedText: string,
  gradeLevel: number,
): Promise<VocabularyWord[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "cb4a-vocab-"));
  const sourcePath = join(tempDir, "chapter.txt");

  try {
    await writeFile(sourcePath, extractedText, "utf8");

    const { stdout: selectorStdout } = await execFileAsync(getPythonCommand(), [
      selectorPath(),
      "--source",
      sourcePath,
      "--grade",
      String(gradeLevel),
    ]);

    const selectorData = JSON.parse(selectorStdout) as { words?: string[] };
    const words = Array.isArray(selectorData.words) ? selectorData.words : [];
    if (words.length === 0) return [];

    const { stdout: enricherStdout } = await execFileAsync(getPythonCommand(), [
      enricherPath(),
      "--source",
      sourcePath,
      "--grade",
      String(gradeLevel),
      "--words",
      JSON.stringify(words),
    ]);

    const enrichedData = JSON.parse(enricherStdout) as { vocabulary?: VocabularyWord[] };
    return Array.isArray(enrichedData.vocabulary) ? enrichedData.vocabulary : [];
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
