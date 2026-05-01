import { db, booksTable, chaptersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { BookCharacterDatabase } from "../ai/characterDatabase.js";

export type BookRecordWithCharacters = {
  id: number;
  title: string;
  author: string;
  grade: number;
  createdAt: Date;
  characterData: BookCharacterDatabase | null;
};

export async function listBooks() {
  return db
    .select({
      id: booksTable.id,
      title: booksTable.title,
      author: booksTable.author,
      grade: booksTable.grade,
      createdAt: booksTable.createdAt,
      chapterCount: sql<number>`cast(count(${chaptersTable.id}) as int)`,
    })
    .from(booksTable)
    .leftJoin(chaptersTable, eq(chaptersTable.bookId, booksTable.id))
    .groupBy(booksTable.id)
    .orderBy(booksTable.createdAt);
}

export async function insertBook(values: {
  title: string;
  author: string;
  grade: number;
  characterData?: BookCharacterDatabase | null;
}): Promise<BookRecordWithCharacters> {
  const [book] = (await db.insert(booksTable).values(values).returning()) as BookRecordWithCharacters[];
  return book;
}

export async function getBookById(bookId: number): Promise<BookRecordWithCharacters | undefined> {
  const [book] = (await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, bookId))) as BookRecordWithCharacters[];
  return book;
}

export async function updateBook(
  bookId: number,
  updates: Partial<{ title: string; author: string; grade: number }>,
) {
  const [book] = await db.update(booksTable).set(updates).where(eq(booksTable.id, bookId)).returning();
  return book;
}

export async function deleteBook(bookId: number): Promise<void> {
  await db.delete(booksTable).where(eq(booksTable.id, bookId));
}

export async function countChapters(bookId: number): Promise<number> {
  const [{ chapterCount }] = await db
    .select({ chapterCount: sql<number>`cast(count(${chaptersTable.id}) as int)` })
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId));
  return chapterCount;
}
