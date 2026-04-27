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
