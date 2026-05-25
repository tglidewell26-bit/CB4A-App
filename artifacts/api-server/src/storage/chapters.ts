import { db, chaptersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export type ChapterRow = typeof chaptersTable.$inferSelect;

export function chapterToResponse(c: ChapterRow) {
  return {
    id: c.id,
    bookId: c.bookId,
    num: c.num,
    title: c.title,
    pages: c.pages,
    status: c.status,
    date: c.date,
    file: c.file,
    lessonChapterCount: c.lessonChapterCount,
    hasWorkbook: !!c.workbookContent,
    hasTeacherGuide: !!c.teacherGuideContent,
    errorMessage: c.errorMessage,
    createdAt: c.createdAt,
  };
}

export async function listChaptersForBook(bookId: number): Promise<ChapterRow[]> {
  return db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId))
    .orderBy(chaptersTable.createdAt);
}

export async function getChapterById(chapterId: number): Promise<ChapterRow | undefined> {
  const [chapter] = await db.select().from(chaptersTable).where(eq(chaptersTable.id, chapterId));
  return chapter;
}

export async function insertChapter(values: {
  bookId: number;
  title: string;
  pages: string;
  num: number | null;
  date: string | null;
  file: string | null;
  extractedText: string | null;
  status: string;
  lessonChapterCount?: number | null;
}): Promise<ChapterRow> {
  const [chapter] = await db.insert(chaptersTable).values(values).returning();
  return chapter;
}

export async function updateChapterFields(
  bookId: number,
  chapterId: number,
  updates: Partial<{ title: string; pages: string; num: number | null }>,
): Promise<ChapterRow | undefined> {
  const [chapter] = await db
    .update(chaptersTable)
    .set(updates)
    .where(and(eq(chaptersTable.id, chapterId), eq(chaptersTable.bookId, bookId)))
    .returning();
  return chapter;
}

export async function deleteChapter(bookId: number, chapterId: number): Promise<void> {
  await db
    .delete(chaptersTable)
    .where(and(eq(chaptersTable.id, chapterId), eq(chaptersTable.bookId, bookId)));
}

export async function setChapterStatus(chapterId: number, status: string): Promise<void> {
  await db.update(chaptersTable).set({ status }).where(eq(chaptersTable.id, chapterId));
}

export async function setChapterGenerating(chapterId: number): Promise<void> {
  await db
    .update(chaptersTable)
    .set({ status: "generating", errorMessage: null })
    .where(eq(chaptersTable.id, chapterId));
}

export async function setChapterError(chapterId: number, errorMessage: string): Promise<void> {
  await db
    .update(chaptersTable)
    .set({ status: "error", errorMessage })
    .where(eq(chaptersTable.id, chapterId));
}

export async function saveGeneratedContent(
  chapterId: number,
  content: { workbookHtml: string; teacherGuideHtml: string; date: string; answersJson: string },
): Promise<void> {
  await db
    .update(chaptersTable)
    .set({
      status: "ready",
      content: content.workbookHtml,
      workbookContent: content.workbookHtml,
      teacherGuideContent: content.teacherGuideHtml,
      answersJson: content.answersJson,
      date: content.date,
      errorMessage: null,
    })
    .where(eq(chaptersTable.id, chapterId));
}
