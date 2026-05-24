import { describe, expect, it } from "vitest";
import {
  getBonusChallengeEventCount,
  getLessonChapterCount,
  type ChapterMeta,
} from "../templateRenderers.js";
import { studentSectionRequirementByKey } from "../../prompts/workbookSectionPrompts.js";
import { teacherSectionRequirementByKey } from "../../prompts/teacherGuidePrompts.js";

const baseMeta: ChapterMeta = {
  bookTitle: "Test Book",
  author: "Author",
  chapterNum: 1,
  chapterTitle: "Chapter One",
  pages: "1-10",
  grade: 4,
  extractedText: "",
};

describe("getLessonChapterCount", () => {
  it("returns 1 when chapterCount is missing", () => {
    expect(getLessonChapterCount(baseMeta)).toBe(1);
  });

  it("returns provided chapterCount when set", () => {
    expect(getLessonChapterCount({ ...baseMeta, chapterCount: 2 })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterCount: 3 })).toBe(3);
  });

  it("clamps invalid (<1) chapterCount up to 1", () => {
    expect(getLessonChapterCount({ ...baseMeta, chapterCount: 0 })).toBe(1);
  });

  it("parses ranges from chapterTitle (Chapter, Ch, Lesson; dash/en-dash/em-dash/to/through)", () => {
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 1-2" })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapter 3–5" })).toBe(3);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chs 2—4" })).toBe(3);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 1 to 4" })).toBe(4);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 2 through 3" })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Lesson 1-2" })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Lessons 4–6" })).toBe(3);
  });

  it("parses lists from chapterTitle (and, &, comma)", () => {
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 2 and 3" })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 4 & 5" })).toBe(2);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapters 1, 2, 3" })).toBe(3);
  });

  it("returns 1 for single-chapter titles", () => {
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "Chapter 1" })).toBe(1);
    expect(getLessonChapterCount({ ...baseMeta, chapterTitle: "The Beginning" })).toBe(1);
  });
});

describe("getBonusChallengeEventCount", () => {
  it("returns 7 (the max of the 6–7 range) for a single-chapter lesson", () => {
    expect(getBonusChallengeEventCount(1)).toBe(7);
  });

  it("returns 10 events for any multi-chapter lesson", () => {
    expect(getBonusChallengeEventCount(2)).toBe(10);
    expect(getBonusChallengeEventCount(5)).toBe(10);
  });
});

describe("studentSectionRequirementByKey — bonus_challenge scaling", () => {
  it("allows 6 or 7 events for a single-chapter lesson", () => {
    const text = studentSectionRequirementByKey("bonus_challenge", 1);
    expect(text).toMatch(/Prefer 7; drop to 6 only if a seventh would be weak filler/);
    expect(text).not.toMatch(/EXACTLY 10 events/);
  });

  it("requires EXACTLY 10 events and mentions multi-chapter scope", () => {
    const text = studentSectionRequirementByKey("bonus_challenge", 2);
    expect(text).toMatch(/EXACTLY 10 events/);
    expect(text).toMatch(/2 chapters/);
  });
});

describe("teacherSectionRequirementByKey — guided_reading scaling", () => {
  it("keeps 3–5 sections for a single-chapter lesson", () => {
    const text = teacherSectionRequirementByKey("guided_reading", 4, 10, undefined, 1);
    expect(text).toMatch(/Use 3–5 sections/);
  });

  it("scales section count for multi-chapter lessons", () => {
    const text = teacherSectionRequirementByKey("guided_reading", 4, 10, undefined, 2);
    expect(text).toMatch(/Use 8–10 sections/);
    expect(text).toMatch(/2 chapters/);
  });
});
