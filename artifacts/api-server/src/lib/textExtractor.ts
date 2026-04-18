import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<string> {
  const lowerName = originalname.toLowerCase();
  const isPdf = mimetype === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc");

  if (isPdf) {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  return buffer.toString("utf8").trim();
}
