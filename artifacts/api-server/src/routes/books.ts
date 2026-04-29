import { Router, type IRouter } from "express";
import multer from "multer";
import { db, booksTable, chaptersTable, insertBookSchema } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  extractTextFromBuffer,
  serializeChapterPages,
} from "../lib/textExtractor.js";
import { enrichVocabularyForTeacherGuide } from "../lib/vocabularyExtractor.js";
import { generateStudentWorkbook, generateTeacherGuide, type BookCharacterDatabase } from "../lib/workbookGenerator.js";
import { logger } from "../lib/logger.js";
import { selectAndEnrichVocabulary } from "../lib/pythonVocabularySelector.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

function emptyCharacterDatabase(title: string, author: string, grade: number): BookCharacterDatabase {
  return {
    book_title: title.trim(),
    author: author.trim(),
    grade_level: grade,
    characters: [],
  };
}

function normalizeCharacterDatabase(raw: unknown, title: string, author: string, grade: number): BookCharacterDatabase {
  const fallback = emptyCharacterDatabase(title, author, grade);
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as { characters?: unknown };
  if (!Array.isArray(candidate.characters)) return fallback;

  const characters = candidate.characters
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const parsed = item as { canonical_name?: unknown; aliases?: unknown };
      if (typeof parsed.canonical_name !== "string") return null;
      if (!Array.isArray(parsed.aliases) || !parsed.aliases.every((a) => typeof a === "string")) return null;
      const canonical_name = parsed.canonical_name.trim();
      const aliases = [...new Set(parsed.aliases.map((a) => a.trim()).filter(Boolean))];
      if (!canonical_name || aliases.length === 0) return null;
      return { canonical_name, aliases };
    })
    .filter((c): c is { canonical_name: string; aliases: string[] } => c !== null);

  return {
    book_title: title.trim(),
    author: author.trim(),
    grade_level: grade,
    characters,
  };
}

async function buildCharacterDatabase(title: string, author: string, grade: number): Promise<BookCharacterDatabase> {
  const fallback = emptyCharacterDatabase(title, author, grade);
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "You return only strict JSON. No markdown. Build a book-level character database for a classic book. Include canonical names and common aliases/spellings only.",
      messages: [
        {
          role: "user",
          content: `Return JSON with shape:
{
  "book_title": "${title.trim()}",
  "author": "${author.trim()}",
  "grade_level": ${grade},
  "characters": [
    { "canonical_name": "Name", "aliases": ["Alias 1", "Alias 2"] }
  ]
}
Rules:
- Include major and recurring characters for the full book, not just chapter 1.
- aliases must include canonical name as one alias.
- No extra keys.
- If unsure, return best-known list for this title.
- Output valid JSON only.`,
        },
      ],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!text) return fallback;
    const parsed = JSON.parse(text) as unknown;
    return normalizeCharacterDatabase(parsed, title, author, grade);
  } catch (err) {
    logger.warn({ err, title, author }, "Character database lookup failed; using empty list fallback.");
    return fallback;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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
      characterDatabase: book.characterData ?? undefined,
    };

    logger.info({ chapterId, bookId }, "Starting AI generation");

    const baseVocabulary = await selectAndEnrichVocabulary(chapter.extractedText, book.grade);
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
  const characterData = await buildCharacterDatabase(parsed.data.title, parsed.data.author, parsed.data.grade);
  const [book] = await db.insert(booksTable).values({ ...parsed.data, characterData }).returning();
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
        extractedText = serializeChapterPages(pages);
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
