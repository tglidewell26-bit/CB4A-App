import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { VocabularyWord } from "./vocabularyExtractor.js";

const execFileAsync = promisify(execFile);

function getPythonCommand(): string {
  return process.env.PYTHON_BIN || "python";
function getPythonCommands(): string[] {
  const configured = process.env.PYTHON_BIN;
  const candidates = [
    configured,
    process.platform === "win32" ? "py" : undefined,
    "python3",
    "python",
  ].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  return [...new Set(candidates)];
}

async function runPythonScript(args: string[]): Promise<string> {
  const candidates = getPythonCommands();
  let lastError: unknown;

  for (const command of candidates) {
    try {
      const { stdout } = await execFileAsync(command, args);
      return stdout;
    } catch (error) {
      const maybeSpawnError = error as NodeJS.ErrnoException;
      if (maybeSpawnError.code === "ENOENT") {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  const attempted = candidates.join(", ");
  const baseMessage =
    lastError instanceof Error ? lastError.message : "No Python interpreter found";
  throw new Error(`Unable to run Python scripts (attempted: ${attempted}). ${baseMessage}`);
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

    const selectorStdout = await runPythonScript([
      selectorPath(),
      "--source",
      sourcePath,
      "--grade",
      String(gradeLevel),
    ]);

    const selectorData = JSON.parse(selectorStdout) as { words?: string[] };
    const words = Array.isArray(selectorData.words) ? selectorData.words : [];
    if (words.length === 0) return [];

    const enricherStdout = await runPythonScript([
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
