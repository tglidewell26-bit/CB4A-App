import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  grade: integer("grade").notNull(),
  characterData: jsonb("character_data").$type<{
    book_title: string;
    author: string;
    grade_level: number;
    characters: { canonical_name: string; aliases: string[] }[];
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true, characterData: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;
