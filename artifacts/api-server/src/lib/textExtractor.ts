import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface PageText {
  page_number: number;
  text: string;
}

const PAGE_SEPARATOR = "\n\n---PAGE---\n\n";

export function serializeChapterPages(pages: PageText[]): string {
  return pages
    .map((page) => `[PAGE ${page.page_number}]\n${page.text}`)
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

  return segments.map((text, index) => ({
    page_number: index + 1,
    text,
  }));
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
    const data = await pdfParse(buffer);
    return splitIntoPages(data.text);
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return splitIntoPages(result.value);
  }

  return splitIntoPages(buffer.toString("utf8"));
}
