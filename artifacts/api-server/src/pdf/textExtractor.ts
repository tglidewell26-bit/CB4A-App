import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export interface PageText {
  page_number: number;
  text: string;
}

const PAGE_SEPARATOR = "\n\n---PAGE---\n\n";
const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Dehyphenates words broken across line ends by the source PDF's typesetting,
 * e.g. "Bar- bara" → "Barbara" and "car- pentry" → "carpentry". The trigger is
 * a hyphen followed by whitespace (a line break or space) — real compound
 * words like "five-penny" have NO space after the hyphen and are left alone.
 * The lowercase-second-half guard avoids accidentally merging proper-noun
 * pairs ("Mary- John") and constructs like "self- Inflicted".
 */
function dehyphenateLineBreaks(text: string): string {
  return text
    .replace(/\u00ad/g, "")
    .replace(/([A-Za-z]+)-\s+([a-z]+)/g, "$1$2");
}

export function serializeChapterPages(pages: PageText[]): string {
  return pages
    .map((page) => `[PAGE ${page.page_number}]\n${dehyphenateLineBreaks(page.text)}`)
    .join(PAGE_SEPARATOR);
}

export function parseStoredChapterPages(extractedText: string): PageText[] {
  return extractedText
    .split(PAGE_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment, index) => {
      const markerMatch = segment.match(/^\[PAGE\s+(\d+)\]\s*\n?/i);
      const parsedPage = markerMatch ? Number(markerMatch[1]) : index + 1;
      const text = markerMatch ? segment.replace(/^\[PAGE\s+\d+\]\s*\n?/i, "") : segment;
      return {
        page_number: Number.isFinite(parsedPage) ? parsedPage : index + 1,
        text: text.trim(),
      };
    })
    .filter((page) => page.text.length > 0);
}

function splitIntoPages(rawText: string): PageText[] {
  const cleaned = rawText.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const formFeedPages = cleaned
    .split("\f")
    .map((part) => part.trim())
    .filter(Boolean);

  const segments = formFeedPages.length > 1
    ? formFeedPages
    : cleaned
        .split(/\n{3,}/)
        .map((part) => part.trim())
        .filter(Boolean);

  let fallbackPage = 1;

  return segments.map((text) => {
    const detectedPage = detectFooterPageNumber(text);

    if (typeof detectedPage === "number") {
      fallbackPage = detectedPage + 1;
      return {
        page_number: detectedPage,
        text,
      };
    }

    const inferredPage = fallbackPage;
    fallbackPage = inferredPage + 1;

    return {
      page_number: inferredPage,
      text,
    };
  });
}

function detectFooterPageNumber(pageText: string): number | null {
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  // Check the bottom lines first: footer page numbers are usually here.
  const footerCandidates = lines.slice(-8).reverse();
  for (const line of footerCandidates) {
    // Matches "23", "- 23 -", "(23)", "[23]", "Page 23", or "23 24" (book spread).
    const spreadMatch = line.match(/^(\d{1,4})\s+(\d{1,4})$/);
    if (spreadMatch) {
      // For spreads, use the higher page number (right-hand page) as the anchor.
      return Math.max(Number(spreadMatch[1]), Number(spreadMatch[2]));
    }

    const singleNumberMatch = line.match(/^[-–—(\[]?\s*(?:page\s*)?(\d{1,4})\s*[-–—)\]]?$/i);
    if (singleNumberMatch) {
      return Number(singleNumberMatch[1]);
    }
  }

  return null;
}

function parseFooterToken(token: string): number | null {
  const normalized = token.trim();
  const spreadMatch = normalized.match(/^(\d{1,4})\s+(\d{1,4})$/);
  if (spreadMatch) return Math.max(Number(spreadMatch[1]), Number(spreadMatch[2]));

  const singleNumberMatch = normalized.match(/^[-–—(\[]?\s*(?:page\s*)?(\d{1,4})\s*[-–—)\]]?$/i);
  if (!singleNumberMatch) return null;

  const pageNumber = Number(singleNumberMatch[1]);
  return Number.isFinite(pageNumber) ? pageNumber : null;
}

type PositionedToken = {
  str: string;
  x: number;
  y: number;
  width: number;
};

function detectBottomCenterFooterPageNumber(
  items: PositionedToken[],
  pageWidth: number,
  pageHeight: number,
): number | null {
  if (items.length === 0 || pageWidth <= 0 || pageHeight <= 0) return null;

  const bottomBandMaxY = pageHeight * 0.2;
  const centerX = pageWidth / 2;
  const centerTolerance = pageWidth * 0.25;

  const footerCandidates = items
    .map((item) => {
      const parsed = parseFooterToken(item.str);
      if (parsed === null) return null;
      return {
        page: parsed,
        xCenter: item.x + item.width / 2,
        y: item.y,
      };
    })
    .filter((candidate): candidate is { page: number; xCenter: number; y: number } => candidate !== null)
    .filter((candidate) => candidate.y <= bottomBandMaxY);

  if (footerCandidates.length === 0) return null;

  const bottomCenterCandidates = footerCandidates
    .filter((candidate) => Math.abs(candidate.xCenter - centerX) <= centerTolerance)
    .sort((a, b) => a.y - b.y || Math.abs(a.xCenter - centerX) - Math.abs(b.xCenter - centerX));

  if (bottomCenterCandidates.length > 0) {
    return bottomCenterCandidates[0].page;
  }

  // Two-page spread fallback: choose the larger footer number in the bottom band.
  return footerCandidates.reduce((maxPage, candidate) => Math.max(maxPage, candidate.page), 0) || null;
}

function buildTextFromPositionedItems(items: PositionedToken[]): string {
  if (items.length === 0) return "";

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  let currentLineY = sorted[0].y;
  let currentLineTokens: string[] = [];

  for (const token of sorted) {
    if (Math.abs(token.y - currentLineY) > 2.5) {
      const line = currentLineTokens.join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
      currentLineY = token.y;
      currentLineTokens = [token.str];
      continue;
    }
    currentLineTokens.push(token.str);
  }

  const finalLine = currentLineTokens.join(" ").replace(/\s+/g, " ").trim();
  if (finalLine) lines.push(finalLine);

  return lines.join("\n").trim();
}

async function extractPdfPagesByFooterLayout(buffer: Buffer): Promise<PageText[]> {
  const pages: PageText[] = [];
  let fallbackPage = 1;

  await pdfParse(buffer, {
    pagerender: async (pageData: {
      getTextContent: (options?: object) => Promise<{ items: Array<Record<string, unknown>> }>;
      getViewport: (options: { scale: number }) => { width: number; height: number };
    }) => {
      const viewport = pageData.getViewport({ scale: 1 });
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      const tokens: PositionedToken[] = textContent.items
        .map((item: Record<string, unknown>) => {
          const str = typeof item.str === "string" ? item.str.trim() : "";
          const transform = Array.isArray(item.transform) ? item.transform : [];
          if (!str || transform.length < 6) return null;
          const width = typeof item.width === "number" ? item.width : 0;
          return {
            str,
            x: Number(transform[4] ?? 0),
            y: Number(transform[5] ?? 0),
            width,
          } satisfies PositionedToken;
        })
        .filter((item): item is PositionedToken => item !== null);

      const pageText = buildTextFromPositionedItems(tokens);
      if (!pageText) return "";

      const detectedFooterPage = detectBottomCenterFooterPageNumber(tokens, viewport.width, viewport.height);
      const pageNumber = typeof detectedFooterPage === "number" ? detectedFooterPage : fallbackPage;
      fallbackPage = pageNumber + 1;

      pages.push({
        page_number: pageNumber,
        text: pageText,
      });

      return pageText;
    },
  });

  return pages;
}

function getPythonCommands(): string[] {
  const configured = process.env.PYTHON_BIN;
  const candidates = [configured, process.platform === "win32" ? "py" : undefined, "python3", "python"].filter(
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
  const baseMessage = lastError instanceof Error ? lastError.message : "No Python interpreter found";
  throw new Error(`Unable to run Python scripts (attempted: ${attempted}). ${baseMessage}`);
}

async function extractPdfPagesByPyMuPdf(buffer: Buffer): Promise<PageText[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "cb4a-pdf-footer-"));
  const sourcePath = join(tempDir, "chapter.pdf");
  const scriptPath = join(REPO_ROOT, "workbook_generator", "pdf_footer_page_extractor.py");

  try {
    await writeFile(sourcePath, buffer);
    const stdout = await runPythonScript([scriptPath, "--source", sourcePath]);
    const parsed = JSON.parse(stdout) as { pages?: PageText[] };
    return Array.isArray(parsed.pages) ? parsed.pages.filter((p) => Number.isFinite(p.page_number) && !!p.text) : [];
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<PageText[]> {
  const lowerName = originalname.toLowerCase();
  const isPdf = mimetype === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc");

  if (isPdf) {
    try {
      const pymupdfPages = await extractPdfPagesByPyMuPdf(buffer);
      if (pymupdfPages.length > 0) return pymupdfPages;
    } catch {
      // Fallback to JS extraction paths when Python/PyMuPDF is unavailable.
    }

    try {
      const layoutPages = await extractPdfPagesByFooterLayout(buffer);
      if (layoutPages.length > 0) return layoutPages;
    } catch {
      // Fallback to plain text parsing when layout extraction is unavailable.
    }

    const data = await pdfParse(buffer);
    return splitIntoPages(data.text);
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return splitIntoPages(result.value);
  }

  return splitIntoPages(buffer.toString("utf8"));
}
