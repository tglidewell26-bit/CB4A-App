export type ChapterStatus = "ready" | "generating" | "pending";

export interface Chapter {
  id: number;
  title: string;
  pages: string;
  status: ChapterStatus;
  date?: string;
  num?: number;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  grade: 3 | 4 | 5 | 6 | 7 | 8;
  chapters: Chapter[];
}

export type GradeColors = {
  bg: string;
  border: string;
  text: string;
};
