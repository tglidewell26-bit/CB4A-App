import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface PageText {
  page_number: number;
  text: string;
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
