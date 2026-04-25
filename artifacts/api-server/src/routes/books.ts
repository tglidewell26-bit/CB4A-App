import { Router, type IRouter } from "express";
import multer from "multer";
import { db, booksTable, chaptersTable, insertBookSchema } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { extractTextFromBuffer, type PageText } from "../lib/textExtractor.js";
import { enrichVocabularyForTeacherGuide, extractVocabulary } from "../lib/vocabularyExtractor.js";
import { generateStudentWorkbook, generateTeacherGuide } from "../lib/workbookGenerator.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const HEIDI_CH1_MANUAL_WORDS = [
  "cozy",
  "guided",
  "encouraged",
  "frustrated",
  "inherited",
  "nimble",
  "attire",
  "gruff",
  "breathtaking",
  "stern",
] as const;

function findSentenceForWord(text: string, word: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const found = sentences.find((s) => new RegExp(`\\b${word}\\b`, "i").test(s));
  return (found ?? "").slice(0, 220).trim();
}

function manualHeidiChapterOneVocabulary(chapterPages: PageText[]) {
  const fallbackPage = chapterPages[0]?.page_number ?? 1;

  return HEIDI_CH1_MANUAL_WORDS.map((word) => {
    const page = chapterPages.find((p) => new RegExp(`\\b${word}\\b`, "i").test(p.text));
    const pageNumber = page?.page_number ?? fallbackPage;
    const quote = page ? findSentenceForWord(page.text, word) : word;
    return {
      word,
      lemma: word,
      page_number: pageNumber,
      book_quote: quote,
      grade_band: "3-5",
      score: 1,
    };
  });
}

function shouldUseHeidiManualVocabulary(bookTitle: string, chapterNum?: number | null): boolean {
  return bookTitle.trim().toLowerCase() === "heidi" && (chapterNum ?? 0) === 1;
}

function chapterToResponse(c: typeof chaptersTable.$inferSelect) {
  return {
    id: c.id,
    bookId: c.bookId,
    num: c.num,
    title: c.title,
    pages: c.pages,
    status: c.status,
    date: c.date,
    file: c.file,
    hasWorkbook: !!c.workbookContent,
    hasTeacherGuide: !!c.teacherGuideContent,
    createdAt: c.createdAt,
  };
}

async function triggerGeneration(
  chapterId: number,
  bookId: number,
): Promise<void> {
  try {
    const [chapter] = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, chapterId));

    if (!chapter || !chapter.extractedText) {
      await db
        .update(chaptersTable)
        .set({ status: "ready" })
        .where(eq(chaptersTable.id, chapterId));
      return;
    }

    const [book] = await db
      .select()
      .from(booksTable)
      .where(eq(booksTable.id, bookId));

    if (!book) {
      await db
        .update(chaptersTable)
        .set({ status: "ready" })
        .where(eq(chaptersTable.id, chapterId));
      return;
    }

    const meta = {
      bookTitle: book.title,
      author: book.author,
      chapterNum: chapter.num ?? undefined,
      chapterTitle: chapter.title,
      pages: chapter.pages,
      grade: book.grade,
      extractedText: chapter.extractedText,
    };

    logger.info({ chapterId, bookId }, "Starting AI generation");

    const chapterPages: PageText[] = chapter.extractedText
      .split("\n\n---PAGE---\n\n")
      .map((text: string, index: number) => ({ page_number: index + 1, text }))
      .filter((page: PageText) => page.text.trim().length > 0);
    const baseVocabulary = shouldUseHeidiManualVocabulary(book.title, chapter.num)
      ? manualHeidiChapterOneVocabulary(chapterPages)
      : extractVocabulary(chapterPages, book.grade);
    const vocabulary = await enrichVocabularyForTeacherGuide(baseVocabulary, book.grade, chapter.extractedText);
    const workbookResult = await generateStudentWorkbook(meta, vocabulary);
    const teacherGuideResult = await generateTeacherGuide(
      meta,
      workbookResult,
      vocabulary,
    );

    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    await db
      .update(chaptersTable)
      .set({
        status: "ready",
        content: workbookResult,
        workbookContent: workbookResult,
        teacherGuideContent: teacherGuideResult,
        date: today,
      })
      .where(eq(chaptersTable.id, chapterId));

    logger.info({ chapterId }, "AI generation complete");
  } catch (err) {
    logger.error({ chapterId, err }, "AI generation failed");
    await db
      .update(chaptersTable)
      .set({ status: "error" })
      .where(eq(chaptersTable.id, chapterId));
  }
}

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

router.patch("/books/:bookId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  const { title, author, grade } = req.body;
  const updates: Partial<{ title: string; author: string; grade: number }> = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof author === "string" && author.trim()) updates.author = author.trim();
  if (grade !== undefined) {
    const gradeNum = Number(grade);
    if (!Number.isInteger(gradeNum) || gradeNum < 3 || gradeNum > 8) {
      res.status(400).json({ error: "Grade must be an integer between 3 and 8" });
      return;
    }
    updates.grade = gradeNum;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [book] = await db.update(booksTable).set(updates).where(eq(booksTable.id, bookId)).returning();
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  const [{ chapterCount }] = await db
    .select({ chapterCount: sql<number>`cast(count(${chaptersTable.id}) as int)` })
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId));
  res.json({ ...book, chapterCount });
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

router.patch("/books/:bookId/chapters/:chapterId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  const chapterId = Number(req.params.chapterId);
  if (isNaN(bookId) || isNaN(chapterId)) {
    res.status(400).json({ error: "Invalid bookId or chapterId" });
    return;
  }
  const { title, pages, num } = req.body;
  const updates: Partial<{ title: string; pages: string; num: number | null }> = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof pages === "string" && pages.trim()) updates.pages = pages.trim();
  if (num !== undefined) {
    if (num === null) {
      updates.num = null;
    } else {
      const numVal = Number(num);
      if (!Number.isInteger(numVal) || numVal < 1) {
        res.status(400).json({ error: "Chapter number must be a positive integer" });
        return;
      }
      updates.num = numVal;
    }
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [chapter] = await db
    .update(chaptersTable)
    .set(updates)
    .where(and(eq(chaptersTable.id, chapterId), eq(chaptersTable.bookId, bookId)))
    .returning();
  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" });
    return;
  }
  res.json(chapterToResponse(chapter));
});

router.delete("/books/:bookId/chapters/:chapterId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  const chapterId = Number(req.params.chapterId);
  if (isNaN(bookId) || isNaN(chapterId)) {
    res.status(400).json({ error: "Invalid bookId or chapterId" });
    return;
  }
  await db.delete(chaptersTable).where(
    and(eq(chaptersTable.id, chapterId), eq(chaptersTable.bookId, bookId))
  );
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
  res.json(chapters.map(chapterToResponse));
});

router.post(
  "/books/:bookId/chapters",
  upload.single("file"),
  async (req, res) => {
    const bookId = Number(req.params.bookId);
    if (isNaN(bookId)) {
      res.status(400).json({ error: "Invalid bookId" });
      return;
    }

    const { title, pages, num, date } = req.body;
    if (!title || !pages) {
      res.status(400).json({ error: "title and pages are required" });
      return;
    }

    const file = req.file;
    let extractedText: string | null = null;
    if (file) {
      try {
        const pages = await extractTextFromBuffer(
          file.buffer,
          file.mimetype,
          file.originalname,
        );
        extractedText = pages.map((p) => p.text).join("\n\n---PAGE---\n\n");
      } catch (err) {
        logger.warn({ err }, "Text extraction failed, continuing without text");
      }
    }

    const hasText = !!extractedText && extractedText.length > 50;
    const initialStatus = hasText ? "generating" : "ready";

    const [chapter] = await db
      .insert(chaptersTable)
      .values({
        bookId,
        title: String(title).trim(),
        pages: String(pages),
        num: num ? Number(num) : null,
        date: date ? String(date) : null,
        file: file ? file.originalname : null,
        extractedText,
        status: initialStatus,
      })
      .returning();

    res.status(201).json(chapterToResponse(chapter));

    if (hasText) {
      setImmediate(() => triggerGeneration(chapter.id, bookId));
    }
  },
);

router.get(
  "/books/:bookId/chapters/:chapterId/workbook",
  async (req, res) => {
    const chapterId = Number(req.params.chapterId);
    if (isNaN(chapterId)) {
      res.status(400).json({ error: "Invalid chapterId" });
      return;
    }
    const [chapter] = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, chapterId));
    if (!chapter || !chapter.workbookContent) {
      res.status(404).json({ error: "Workbook not yet generated" });
      return;
    }
    res.json({
      content: chapter.workbookContent,
      chapterId,
      type: "workbook",
    });
  },
);

router.get(
  "/books/:bookId/chapters/:chapterId/teacher-guide",
  async (req, res) => {
    const chapterId = Number(req.params.chapterId);
    if (isNaN(chapterId)) {
      res.status(400).json({ error: "Invalid chapterId" });
      return;
    }
    const [chapter] = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, chapterId));
    if (!chapter || !chapter.teacherGuideContent) {
      res.status(404).json({ error: "Teacher guide not yet generated" });
      return;
    }
    res.json({
      content: chapter.teacherGuideContent,
      chapterId,
      type: "teacher-guide",
    });
  },
);

router.post(
  "/books/:bookId/chapters/:chapterId/regenerate",
  async (req, res) => {
    const bookId = Number(req.params.bookId);
    const chapterId = Number(req.params.chapterId);
    if (isNaN(bookId) || isNaN(chapterId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [chapter] = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.id, chapterId));

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    if (chapter.status === "generating") {
      res.status(409).json({ error: "Chapter is already generating" });
      return;
    }

    if (!chapter.extractedText || chapter.extractedText.length < 50) {
      res.status(422).json({ error: "No chapter text available for regeneration. Please re-upload the file." });
      return;
    }

    await db
      .update(chaptersTable)
      .set({ status: "generating" })
      .where(eq(chaptersTable.id, chapterId));

    const updated = { ...chapter, status: "generating" };
    res.status(202).json(chapterToResponse(updated));

    setImmediate(() => triggerGeneration(chapterId, bookId));
  },
);

export default router;
