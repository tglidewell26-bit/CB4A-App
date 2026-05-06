import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { booksTable } from "./books";

export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => booksTable.id, { onDelete: "cascade" }),
  num: integer("num"),
  title: text("title").notNull(),
  pages: text("pages").notNull(),
  status: text("status").notNull().default("pending"),
  date: text("date"),
  file: text("file"),
  extractedText: text("extracted_text"),
  content: text("content"),
  workbookContent: text("workbook_content"),
  teacherGuideContent: text("teacher_guide_content"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChapterSchema = createInsertSchema(chaptersTable).omit({ id: true, createdAt: true });
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;
