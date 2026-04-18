import { Router, type IRouter } from "express";
import { db, booksTable, chaptersTable, insertBookSchema, insertChapterSchema } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/books", async (_req, res) => {
  const books = await db
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
  res.json(books);
});

router.post("/books", async (req, res) => {
  const parsed = insertBookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [book] = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json({ ...book, chapterCount: 0 });
});

router.delete("/books/:bookId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  await db.delete(booksTable).where(eq(booksTable.id, bookId));
  res.status(204).send();
});

router.get("/books/:bookId/chapters", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId))
    .orderBy(chaptersTable.createdAt);
  res.json(chapters);
});

router.post("/books/:bookId/chapters", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  const bodySchema = insertChapterSchema.omit({ bookId: true });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [chapter] = await db
    .insert(chaptersTable)
    .values({ ...parsed.data, bookId })
    .returning();
  res.status(201).json(chapter);
});

export default router;
