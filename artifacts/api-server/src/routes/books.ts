import { Router, type IRouter } from "express";
import multer from "multer";
import { insertBookSchema } from "@workspace/db";
import { buildCharacterDatabase } from "../ai/characterDatabase.js";
import { createStandardsProfileForFolder } from "../standards/index.js";
import type { GradeLevel } from "../standards/types.js";
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
  setChapterError,
  setChapterGenerating,
  setChapterStatus,
  updateChapterFields,
} from "../storage/chapters.js";
/**
 * Maps internal generation errors to a teacher-facing message. Falls back to
 * the raw message so we never hide useful diagnostic information.
 */
function friendlyGenerationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/missing the ".*" delimiter|delimiters are out of order/i.test(raw)) {
    return "The AI returned an incomplete response (a section delimiter was missing). This is usually a transient issue — try again.";
  }
  if (/JSON parse failed|must be an object|must be an array|must be a string|expected \d/i.test(raw)) {
    return "The AI returned a malformed response for one of the answer sections. Try again — this usually resolves on a retry.";
  }
  if (/validation failed/i.test(raw)) {
    return "The generated content didn't match the required structure. Try again, or report this if it keeps happening.";
  }
  if (/words_to_know must output/i.test(raw)) {
    return "The AI didn't format the Words to Know section correctly. Try again — this usually resolves on a retry.";
  }
  if (/(rate.?limit|429|overloaded|timeout|ECONNRESET|fetch failed|network)/i.test(raw)) {
    return "Couldn't reach the AI service. Wait a moment and try again.";
  }
  return `Generation failed: ${raw}`;
}

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function triggerGeneration(chapterId: number, bookId: number): Promise<void> {
  let chapterLogContext: { chapterNum: number | null; chapterTitle: string | null } = {
    chapterNum: null,
    chapterTitle: null,
  };
  let bookLogContext: { bookTitle: string | null } = { bookTitle: null };
  try {
    const chapter = await getChapterById(chapterId);
    if (!chapter || !chapter.extractedText) {
      await setChapterStatus(chapterId, "ready");
      return;
    }
    chapterLogContext = { chapterNum: chapter.num, chapterTitle: chapter.title };

    const book = await getBookById(bookId);
    if (!book) {
      await setChapterStatus(chapterId, "ready");
      return;
    }
    bookLogContext = { bookTitle: book.title };

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
      chapterCount: chapter.lessonChapterCount ?? undefined,
    };

    logger.info({ chapterId, bookId }, "Starting AI generation");

    const baseVocabulary = selectAndEnrichVocabulary(chapter.extractedText, book.grade);
    const vocabulary = await enrichVocabularyForTeacherGuide(
      baseVocabulary,
      book.grade,
      chapter.extractedText,
    );
    const workbookResult = await generateStudentWorkbook(meta, vocabulary);
    const teacherGuideHtml = await generateTeacherGuide(meta, workbookResult, vocabulary);

    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    await saveGeneratedContent(chapterId, {
      workbookHtml: workbookResult.html,
      teacherGuideHtml,
      date: today,
      answersJson: JSON.stringify(workbookResult.answers),
    });

    logger.info({ chapterId }, "AI generation complete");
  } catch (err) {
    const friendlyMessage = friendlyGenerationError(err);
    logger.error(
      {
        chapterId,
        bookId,
        chapterNum: chapterLogContext.chapterNum,
        chapterTitle: chapterLogContext.chapterTitle,
        bookTitle: bookLogContext.bookTitle,
        err,
      },
      "AI generation failed",
    );
    await setChapterError(chapterId, friendlyMessage);
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
  const standardsProfile = createStandardsProfileForFolder(parsed.data.grade as GradeLevel);
  res.status(201).json({ ...book, chapterCount: 0, standardsProfile });
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

router.post("/books/:bookId/chapters", upload.array("files", 20), async (req, res) => {
  const bookId = Number(req.params.bookId);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }

  const { title, pages, num, date, lessonChapterCount } = req.body;
  if (!title || !pages) {
    res.status(400).json({ error: "title and pages are required" });
    return;
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  let extractedText: string | null = null;

  if (files.length > 0) {
    const allPages: import("../pdf/textExtractor.js").PageText[] = [];
    for (const file of files) {
      try {
        const pages = await extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
        allPages.push(...pages);
      } catch (err) {
        logger.warn({ err, filename: file.originalname }, "Text extraction failed for file, skipping");
      }
    }
    if (allPages.length > 0) {
      extractedText = serializeChapterPages(allPages);
    }
  }

  const hasText = !!extractedText && extractedText.length > 50;
  const initialStatus = hasText ? "generating" : "ready";
  const fileNames = files.map((f) => f.originalname).join(", ") || null;

  const parsedLessonChapterCount =
    lessonChapterCount != null && !isNaN(Number(lessonChapterCount)) && Number(lessonChapterCount) >= 1
      ? Math.trunc(Number(lessonChapterCount))
      : null;

  const chapter = await insertChapter({
    bookId,
    title: String(title).trim(),
    pages: String(pages),
    num: num ? Number(num) : null,
    date: date ? String(date) : null,
    file: fileNames,
    extractedText,
    status: initialStatus,
    lessonChapterCount: parsedLessonChapterCount,
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

  await setChapterGenerating(chapterId);

  const updated = { ...chapter, status: "generating", errorMessage: null };
  res.status(202).json(chapterToResponse(updated));

  setImmediate(() => triggerGeneration(chapterId, bookId));
});

export default router;
