import { relations } from "drizzle-orm";
import { booksTable } from "./books";
import { chaptersTable } from "./chapters";

export const booksRelations = relations(booksTable, ({ many }) => ({
  chapters: many(chaptersTable),
}));

export const chaptersRelations = relations(chaptersTable, ({ one }) => ({
  book: one(booksTable, {
    fields: [chaptersTable.bookId],
    references: [booksTable.id],
  }),
}));
