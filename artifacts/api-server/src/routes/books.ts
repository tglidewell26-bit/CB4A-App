import { Router, type IRouter } from "express";
import multer from "multer";
import { insertBookSchema } from "@workspace/db";
import { buildCharacterDatabase } from "../ai/characterDatabase.js";
import { generateStudentWorkbook } from "../generation/studentWorkbook.js";
import { generateTeacherGuide } from "../generation/teacherGuide.js";
import { extractTextFromBuffer, serializeChapterPages } from "../pdf/textExtractor.js";
import {
  enrichVocabularyForTeacherGuide,
  selectAndEnrichVocabulary,
} from "../vocabulary/index.js";
import { logger } from "../lib/logger.js";
import {
  countChapters,
  deleteBook,
  getBookById,
  insertBook,
  listBooks,
  updateBook,
} from "../storage/books.js";
import {
  chapterToResponse,
  deleteChapter,
  getChapterById,
  insertChapter,
  listChaptersForBook,
  saveGeneratedContent,
  setChapterStatus,
  updateChapterFields,
} from "../storage/chapters.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function triggerGeneration(chapterId: number, bookId: number): Promise<void> {
  try {
    const chapter = await getChapterById(chapterId);
    if (!chapter || !chapter.extractedText) {
      await setChapterStatus(chapterId, "ready");
      return;
    }

    const book = await getBookById(bookId);
    if (!book) {
      await setChapterStatus(chapterId, "ready");
      return;
    }

    const characterDatabase =
      book.characterData ?? (await buildCharacterDatabase(book.title, book.author, book.grade));

    const meta = {
      bookTitle: book.title,
      author: book.author,
      chapterNum: chapter.num ?? undefined,
      chapterTitle: chapter.title,
      pages: chapter.pages,
      grade: book.grade,
      extractedText: chapter.extractedText,
      characterDatabase,
    };

    logger.info({ chapterId, bookId }, "Starting AI generation");

    const baseVocabulary = selectAndEnrichVocabulary(chapter.extractedText, book.grade);
    const vocabulary = await enrichVocabularyForTeacherGuide(
      baseVocabulary,
      book.grade,
      chapter.extractedText,
    );
    const workbookHtml = await generateStudentWorkbook(meta, vocabulary);
    const teacherGuideHtml = await generateTeacherGuide(meta, workbookHtml, vocabulary);

    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    await saveGeneratedContent(chapterId, { workbookHtml, teacherGuideHtml, date: today });

    logger.info({ chapterId }, "AI generation complete");
  } catch (err) {
    logger.error({ chapterId, err }, "AI generation failed");
    await setChapterStatus(chapterId, "error");
  }
}

router.get("/books", async (_req, res) => {
  res.json(await listBooks());
});

router.post("/books", async (req, res) => {
  const parsed = insertBookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const characterData = await buildCharacterDatabase(parsed.data.title, parsed.data.author, parsed.data.grade);
  const book = await insertBook({ ...parsed.data, characterData });
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
  const book = await updateBook(bookId, updates);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  const chapterCount = await countChapters(bookId);
  res.json({ ...book, chapterCount });
});

router.delete("/books/:bookId", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  await deleteBook(bookId);
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
  const chapter = await updateChapterFields(bookId, chapterId, updates);
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
  await deleteChapter(bookId, chapterId);
  res.status(204).send();
});

router.get("/books/:bookId/chapters", async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  const chapters = await listChaptersForBook(bookId);
  res.json(chapters.map(chapterToResponse));
});

router.post("/books/:bookId/chapters", upload.single("file"), async (req, res) => {
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
      const extractedPages = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
      extractedText = serializeChapterPages(extractedPages);
    } catch (err) {
      logger.warn({ err }, "Text extraction failed, continuing without text");
    }
  }

  const hasText = !!extractedText && extractedText.length > 50;
  const initialStatus = hasText ? "generating" : "ready";

  const chapter = await insertChapter({
    bookId,
    title: String(title).trim(),
    pages: String(pages),
    num: num ? Number(num) : null,
    date: date ? String(date) : null,
    file: file ? file.originalname : null,
    extractedText,
    status: initialStatus,
  });

  res.status(201).json(chapterToResponse(chapter));

  if (hasText) {
    setImmediate(() => triggerGeneration(chapter.id, bookId));
  }
});

router.get("/books/:bookId/chapters/:chapterId/workbook", async (req, res) => {
  const chapterId = Number(req.params.chapterId);
  if (isNaN(chapterId)) {
    res.status(400).json({ error: "Invalid chapterId" });
    return;
  }
  const chapter = await getChapterById(chapterId);
  if (!chapter || !chapter.workbookContent) {
    res.status(404).json({ error: "Workbook not yet generated" });
    return;
  }
  res.json({ content: chapter.workbookContent, chapterId, type: "workbook" });
});

router.get("/books/:bookId/chapters/:chapterId/teacher-guide", async (req, res) => {
  const chapterId = Number(req.params.chapterId);
  if (isNaN(chapterId)) {
    res.status(400).json({ error: "Invalid chapterId" });
    return;
  }
  const chapter = await getChapterById(chapterId);
  if (!chapter || !chapter.teacherGuideContent) {
    res.status(404).json({ error: "Teacher guide not yet generated" });
    return;
  }
  res.json({ content: chapter.teacherGuideContent, chapterId, type: "teacher-guide" });
});

router.post("/books/:bookId/chapters/:chapterId/regenerate", async (req, res) => {
  const bookId = Number(req.params.bookId);
  const chapterId = Number(req.params.chapterId);
  if (isNaN(bookId) || isNaN(chapterId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const chapter = await getChapterById(chapterId);
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

  await setChapterStatus(chapterId, "generating");

  const updated = { ...chapter, status: "generating" };
  res.status(202).json(chapterToResponse(updated));

  setImmediate(() => triggerGeneration(chapterId, bookId));
});

export default router;
