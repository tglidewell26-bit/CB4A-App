/**
 * fix-html-chapters.ts
 *
 * One-time (and re-runnable) script that identifies chapters whose stored
 * `workbook_content` or `teacher_guide_content` is legacy HTML — content
 * generated before PR #9 switched AI output to Markdown — and re-generates
 * them via the same pipeline used by the /regenerate endpoint.
 *
 * Legacy HTML is detected by the same heuristic used in
 * ContentPreviewModal.tsx:
 *   - content starts with "<div"  (raw HTML)
 *   - content starts with "```html"  (HTML wrapped in a code fence)
 *
 * Run (from workspace root):
 *   pnpm --filter @workspace/api-server fix-html-chapters
 *
 * The script is idempotent: chapters that are already Markdown are skipped.
 * Chapters that lack extracted_text (and therefore cannot be regenerated
 * without re-uploading the file) are reported but not modified.
 */

import { db, booksTable, chaptersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractVocabulary } from "../lib/vocabularyExtractor.js";
import { generateStudentWorkbook, generateTeacherGuide } from "../lib/workbookGenerator.js";
import type { PageText } from "../lib/textExtractor.js";

function isLegacyHtml(content: string | null): boolean {
  if (!content) return false;
  const trimmed = content.trimStart();
  return trimmed.startsWith("<div") || trimmed.startsWith("```html");
}

async function regenerateChapter(chapterId: number, bookId: number): Promise<void> {
  const [chapter] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, chapterId));
  if (!chapter?.extractedText) throw new Error("No extracted text available");

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) throw new Error("Book not found");

  const meta = {
    bookTitle: book.title,
    author: book.author,
    chapterNum: chapter.num ?? undefined,
    chapterTitle: chapter.title,
    pages: chapter.pages,
    grade: book.grade,
    extractedText: chapter.extractedText,
  };

  const chapterPages: PageText[] = chapter.extractedText
    .split("\n\n---PAGE---\n\n")
    .map((text: string, index: number) => ({ page_number: index + 1, text }))
    .filter((page: PageText) => page.text.trim().length > 0);

  const vocabulary = extractVocabulary(chapterPages, book.grade);
  const workbookMarkdown = await generateStudentWorkbook(meta, vocabulary);
  const teacherGuideMarkdown = await generateTeacherGuide(meta, workbookMarkdown, vocabulary);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  await db
    .update(chaptersTable)
    .set({
      status: "ready",
      date: today,
      content: workbookMarkdown,
      workbookContent: workbookMarkdown,
      teacherGuideContent: teacherGuideMarkdown,
    })
    .where(eq(chaptersTable.id, chapterId));
}

async function main() {
  console.log("Scanning for chapters with legacy HTML content…\n");

  const allChapters = await db.select().from(chaptersTable);

  const htmlChapters = allChapters.filter(
    (c) => isLegacyHtml(c.workbookContent) || isLegacyHtml(c.teacherGuideContent),
  );

  if (htmlChapters.length === 0) {
    console.log("No chapters with legacy HTML content found. Nothing to do.");
    return;
  }

  console.log(`Found ${htmlChapters.length} chapter(s) with legacy HTML content:\n`);
  for (const c of htmlChapters) {
    console.log(`  - Chapter ${c.id}: "${c.title}" (book_id=${c.bookId})`);
  }
  console.log();

  const canRegenerate = htmlChapters.filter(
    (c) => c.extractedText && c.extractedText.length >= 50,
  );
  const cannotRegenerate = htmlChapters.filter(
    (c) => !c.extractedText || c.extractedText.length < 50,
  );

  if (cannotRegenerate.length > 0) {
    console.warn("The following chapters have no extracted text and must be re-uploaded:");
    for (const c of cannotRegenerate) {
      console.warn(`  - Chapter ${c.id}: "${c.title}" (book_id=${c.bookId})`);
    }
    console.log();
  }

  for (const chapter of canRegenerate) {
    console.log(`Regenerating chapter ${chapter.id}: "${chapter.title}"…`);
    await db
      .update(chaptersTable)
      .set({ status: "generating" })
      .where(eq(chaptersTable.id, chapter.id));

    try {
      await regenerateChapter(chapter.id, chapter.bookId);
      console.log(`  ✓ Done — Markdown content stored for chapter ${chapter.id}`);
    } catch (err) {
      console.error(`  ✗ Failed for chapter ${chapter.id}:`, err);
      await db
        .update(chaptersTable)
        .set({ status: "error" })
        .where(eq(chaptersTable.id, chapter.id));
    }
  }

  console.log("\nAll eligible chapters have been regenerated.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
