import { describe, expect, it } from "vitest";
import {
  buildTeacherSectionSystemPrompt,
  buildTeacherSectionUserPrompt,
  teacherSectionRequirementByKey,
  type TeacherGuidePromptInputs,
} from "../teacherGuidePrompts.js";

const baseInputs: TeacherGuidePromptInputs = {
  sectionKey: "measurable_objectives",
  bookTitle: "Test Book",
  author: "Test Author",
  chapterLabel: "Chapter 1",
  pages: "1-10",
  grade: 4,
  vocabulary: [],
  sectionDisplayTitle: "Measurable Objectives",
  workbookContext: {},
  chapterText: "A short chapter text.",
};

describe("teacherGuidePrompts", () => {
  it("includes available grade-level standards in measurable objectives requirements", () => {
    const requirement = teacherSectionRequirementByKey("measurable_objectives", 4);

    expect(requirement).toContain("Available standards (use ONLY these");
    expect(requirement).toContain("RL.4.1");
    expect(requirement).toContain("W.4.3");
    expect(requirement).toContain("SL.4.1");
    expect(requirement).not.toContain("RL.5.1");
  });

  it("appends the standards block to the system prompt before the user prompt is sent", () => {
    const systemPrompt = buildTeacherSectionSystemPrompt(baseInputs);
    const userPrompt = buildTeacherSectionUserPrompt(baseInputs);

    expect(systemPrompt).toContain("Required section key: measurable_objectives");
    expect(systemPrompt).toContain("Available standards (use ONLY these");
    expect(systemPrompt).toContain("RL.4.1");
    expect(userPrompt).not.toContain("Available standards (use ONLY these");
  });

  it("continues to include standards context for the standards section itself", () => {
    const requirement = teacherSectionRequirementByKey("standards", 4);

    expect(requirement).toContain("Available standards (use ONLY these");
    expect(requirement).toContain("RL.4.1");
  });
});
