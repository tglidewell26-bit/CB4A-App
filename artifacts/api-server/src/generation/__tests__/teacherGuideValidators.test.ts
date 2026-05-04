import { describe, it, expect } from "vitest";

import { validateTeacherGuideSectionStructure } from "../workbookValidators.js";
import type { ChapterMeta, GeneratedSection } from "../templateRenderers.js";

const meta: ChapterMeta = {
  bookTitle: "Test Book",
  author: "Test Author",
  chapterNum: 1,
  chapterTitle: "First Chapter",
  pages: "4-12",
  grade: 4,
  extractedText: "Some text.",
};

function section(key: string, bodyHtml: string): GeneratedSection {
  return {
    key,
    displayTitle: key,
    standingSubheader: null,
    bodySource: "llm",
    bodyHtml,
  };
}

describe("validateTeacherGuideSectionStructure", () => {
  it("lesson_overview requires exact required tip text only", () => {
    expect(() =>
      validateTeacherGuideSectionStructure(section("lesson_overview", "<p>overview</p>"), meta),
    ).toThrow(/exact required lesson tip text/);
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("lesson_overview", "<p><em>Tip: This lesson is designed to fit within a 60-minute instructional period. It may be split into two 30-minute sessions if needed.</em></p>"),
        meta,
      ),
    ).not.toThrow();
  });

  it("measurable_objectives requires 5-6 bullets with grade-matching codes", () => {
    const fiveBullets = (codes: string[]) =>
      `<ul>${codes.map((c) => `<li>Students will be able to do something (${c})</li>`).join("")}</ul>`;
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("measurable_objectives", fiveBullets(["RL.4.1", "RL.4.2", "W.4.1", "L.4.4", "SL.4.1"])),
        meta,
      ),
    ).not.toThrow();
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("measurable_objectives", fiveBullets(["RL.4.1", "RL.4.2", "W.4.1"])),
        meta,
      ),
    ).toThrow(/5–6/);
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("measurable_objectives", fiveBullets(["RL.4.1", "RL.4.2", "RL.3.1", "W.4.1", "L.4.4"])),
        meta,
      ),
    ).toThrow(/RL\.3\.1/);
  });

  it("standards requires the table class, headers, and one row per required strand", () => {
    const good = `<table class="tg-standards-table"><thead><tr><th>Standard</th><th>Description</th><th>Lesson Section(s)</th></tr></thead><tbody><tr><td>RL.4.1</td><td>x</td><td>y</td></tr><tr><td>W.4.1</td><td>x</td><td>y</td></tr><tr><td>L.4.4</td><td>x</td><td>y</td></tr><tr><td>SL.4.1</td><td>x</td><td>y</td></tr></tbody></table>`;
    expect(() => validateTeacherGuideSectionStructure(section("standards", good), meta)).not.toThrow();
    expect(() =>
      validateTeacherGuideSectionStructure(section("standards", "<p>nope</p>"), meta),
    ).toThrow(/tg-standards-table/);
    const noLanguage = good.replace(/<tr><td>L\.4\.4<\/td>[\s\S]*?<\/tr>/, "");
    expect(() =>
      validateTeacherGuideSectionStructure(section("standards", noLanguage), meta),
    ).toThrow(/Language/);
    const wrongGrade = good.replace("RL.4.1", "RL.3.1");
    expect(() =>
      validateTeacherGuideSectionStructure(section("standards", wrongGrade), meta),
    ).toThrow(/grade 4/);
    const fabricated = good.replace("RL.4.1", "RL.4.99");
    expect(() =>
      validateTeacherGuideSectionStructure(section("standards", fabricated), meta),
    ).toThrow(/unknown standard code/);
  });

  it("words_to_know_mini_lesson enforces three sub-blocks in order plus an inline tip callout", () => {
    const good = `
      <div class="tg-subblock"><h3>Activities</h3><p>x</p></div>
      <div class="tg-subblock"><h3>Partner Practice</h3><p>x</p></div>
      <div class="tg-subblock"><h3>Quick Check</h3><p>x</p></div>
      <div class="tg-tip"><strong>Vocabulary tip:</strong> y</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("words_to_know_mini_lesson", good), meta),
    ).not.toThrow();
    const noTip = good.replace(/<div class="tg-tip">[\s\S]*?<\/div>/, "");
    expect(() =>
      validateTeacherGuideSectionStructure(section("words_to_know_mini_lesson", noTip), meta),
    ).toThrow(/tg-tip/);
    const reordered = `
      <div class="tg-subblock"><h3>Quick Check</h3></div>
      <div class="tg-subblock"><h3>Activities</h3></div>
      <div class="tg-subblock"><h3>Partner Practice</h3></div>
      <div class="tg-tip">x</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("words_to_know_mini_lesson", reordered), meta),
    ).toThrow(/out-of-order|missing/);
  });

  it("guided_reading requires page ranges and tagged pause-points per section", () => {
    const good = `
      <div class="tg-gr-section"><h3>Section 1: pages 4–6</h3>
        <ol class="tg-pause-points"><li>Q1 [question-type: comprehension]</li><li>Q2 [question-type: inference]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 2: pages 7–9</h3>
        <ol class="tg-pause-points"><li>Q [question-type: comprehension]</li><li>Q [question-type: analysis]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 3: pages 10–12</h3>
        <ol class="tg-pause-points"><li>Q [question-type: inference]</li><li>Q [question-type: evaluation]</li></ol></div>
      <div class="tg-tip">Tip</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("guided_reading", good), meta),
    ).not.toThrow();
    const noPages = good.replace(/pages \d+–\d+/g, "Section");
    expect(() =>
      validateTeacherGuideSectionStructure(section("guided_reading", noPages), meta),
    ).toThrow(/page range/);
  });

  it("creative_response_common_errors requires exact heading order with one paragraph each", () => {
    const good = `
      <div class="tg-common-errors">
        <h4>No Specific Details From The Chapter</h4><p>x</p>
        <h4>Breaking Character</h4><p>x</p>
        <h4>Retelling The Whole Chapter Instead of Focusing on [character's name] Experience</h4><p>x</p>
        <h4>No Evidence From the Text</h4><p>x</p>
        <h4>Modern Language That Doesn't Fit The Story.</h4><p>x</p>
      </div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("creative_response_common_errors", good),
        meta,
      ),
    ).not.toThrow();
    const wrongOrder = good.replace("Breaking Character", "Not This");
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("creative_response_common_errors", wrongOrder),
        meta,
      ),
    ).toThrow(/required five titles/);
  });

  it("exit_ticket requires Prompt, Success Criteria (>=3), Example Responses (>=1) sub-blocks", () => {
    const good = `
      <div class="tg-subblock"><h3>Prompt</h3><p>p</p></div>
      <div class="tg-subblock"><h3>Success Criteria</h3><ul><li>a</li><li>b</li><li>c</li></ul></div>
      <div class="tg-subblock"><h3>Example Responses</h3><ol><li>x</li></ol></div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("exit_ticket", good), meta),
    ).not.toThrow();
    expect(() =>
      validateTeacherGuideSectionStructure(
        section("exit_ticket", '<div class="tg-subblock"><h3>Prompt</h3></div>'),
        meta,
      ),
    ).toThrow(/success criteria|example responses/i);
    const tooFewCriteria = good.replace("<li>a</li><li>b</li><li>c</li>", "<li>a</li><li>b</li>");
    expect(() =>
      validateTeacherGuideSectionStructure(section("exit_ticket", tooFewCriteria), meta),
    ).toThrow(/Success Criteria.*at least 3/);
    const noExamples = good.replace(/<div class="tg-subblock"><h3>Example Responses<\/h3><ol><li>x<\/li><\/ol><\/div>/, '<div class="tg-subblock"><h3>Example Responses</h3><p>none</p></div>');
    expect(() =>
      validateTeacherGuideSectionStructure(section("exit_ticket", noExamples), meta),
    ).toThrow(/Example Responses.*at least 1/);
  });

  it("differentiated_supports requires all 3 learner groups and Before/During/After phases", () => {
    const phases = `<p>Before reading:</p><ul><li>x</li></ul><p>During reading:</p><ul><li>y</li></ul><p>After reading:</p><ul><li>z</li></ul>`;
    const good = `
      <div class="tg-subblock tg-supports"><h3>Struggling Readers</h3>${phases}</div>
      <div class="tg-subblock tg-supports"><h3>English Language Learners</h3>${phases}</div>
      <div class="tg-subblock tg-supports"><h3>Advanced Students</h3>${phases}</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("differentiated_supports", good), meta),
    ).not.toThrow();
    const missingGroup = good.replace(/<h3>Advanced Students<\/h3>/, "<h3>Other</h3>");
    expect(() =>
      validateTeacherGuideSectionStructure(section("differentiated_supports", missingGroup), meta),
    ).toThrow(/advanced students/i);
  });
});

describe("sanitize → validate integration for Teacher Guide sections", () => {
  it("sanitizer preserves h3/h4 structure that the new TG validators require", async () => {
    const { sanitizeLlmBodyHtml } = await import("../htmlSanitizer.js");
    const fakeSchema = {
      key: "words_to_know_mini_lesson",
      display_title: "Words to Know Mini-Lesson",
      standing_subheader: null,
      body_source: "llm" as const,
      required: true,
    };
    const raw = `
      <div class="tg-subblock"><h3>Activities</h3><p>x</p></div>
      <div class="tg-subblock"><h3>Partner Practice</h3><p>x</p></div>
      <div class="tg-subblock"><h3>Quick Check</h3><p>x</p></div>
      <div class="tg-tip"><strong>Vocabulary tip:</strong> y</div>`;
    const { cleaned } = sanitizeLlmBodyHtml(raw, fakeSchema);
    expect(cleaned).toContain("<h3>Activities</h3>");
    expect(cleaned).toContain("<h3>Partner Practice</h3>");
    expect(cleaned).toContain("<h3>Quick Check</h3>");
    expect(cleaned).toContain("Vocabulary tip");
    expect(() =>
      validateTeacherGuideSectionStructure(section("words_to_know_mini_lesson", cleaned), meta),
    ).not.toThrow();
  });

  it("sanitizer still strips h1/h2 (would duplicate the section title)", async () => {
    const { sanitizeLlmBodyHtml } = await import("../htmlSanitizer.js");
    const fakeSchema = {
      key: "lesson_overview",
      display_title: "Lesson Overview",
      standing_subheader: null,
      body_source: "llm" as const,
      required: true,
    };
    const raw = `<h1>Big title</h1><h2>Another</h2><h3>Keep me</h3><p>body</p>`;
    const { cleaned } = sanitizeLlmBodyHtml(raw, fakeSchema);
    expect(cleaned).not.toContain("<h1>");
    expect(cleaned).not.toContain("<h2>");
    expect(cleaned).toContain("<h3>Keep me</h3>");
  });
});

describe("guided_reading page-range coverage validation", () => {
  it("rejects page ranges outside the chapter span", () => {
    const meta4to12: ChapterMeta = { ...meta, pages: "4-12" };
    const html = `
      <div class="tg-gr-section"><h3>Section 1: pages 4–6</h3>
        <ol><li>Q [question-type: comprehension]</li><li>Q [question-type: inference]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 2: pages 7–9</h3>
        <ol><li>Q [question-type: comprehension]</li><li>Q [question-type: analysis]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 3: pages 10–20</h3>
        <ol><li>Q [question-type: inference]</li><li>Q [question-type: evaluation]</li></ol></div>
      <div class="tg-tip">Tip</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("guided_reading", html), meta4to12),
    ).toThrow(/outside the chapter span/);
  });

  it("rejects when sections do not span the full chapter", () => {
    const meta4to12: ChapterMeta = { ...meta, pages: "4-12" };
    const html = `
      <div class="tg-gr-section"><h3>Section 1: pages 4–5</h3>
        <ol><li>Q [question-type: comprehension]</li><li>Q [question-type: inference]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 2: pages 6–7</h3>
        <ol><li>Q [question-type: comprehension]</li><li>Q [question-type: analysis]</li></ol></div>
      <div class="tg-gr-section"><h3>Section 3: pages 8–9</h3>
        <ol><li>Q [question-type: inference]</li><li>Q [question-type: evaluation]</li></ol></div>
      <div class="tg-tip">Tip</div>`;
    expect(() =>
      validateTeacherGuideSectionStructure(section("guided_reading", html), meta4to12),
    ).toThrow(/do not span the full chapter/);
  });
});

describe("standards data — L and SL coverage for grades 3–8", () => {
  it("includes L.x.4, L.x.5, SL.x.1, SL.x.3 for every supported grade", async () => {
    const { ALL_STANDARDS } = await import("../../standards/elaStandards.js");
    for (const grade of [3, 4, 5, 6, 7, 8] as const) {
      for (const code of [`L.${grade}.4`, `L.${grade}.5`, `SL.${grade}.1`, `SL.${grade}.3`]) {
        const found = ALL_STANDARDS.find((s) => s.code === code);
        expect(found, `expected standard ${code}`).toBeTruthy();
        expect(found?.grade).toBe(grade);
      }
    }
  });

  it("formatStandardsForPrompt groups L and SL strands with labels", async () => {
    const { formatStandardsForPrompt } = await import("../../standards/index.js");
    const out = formatStandardsForPrompt(5);
    expect(out).toContain("Language (L):");
    expect(out).toContain("Speaking and Listening (SL):");
    expect(out).toContain("L.5.4:");
    expect(out).toContain("SL.5.1:");
  });
});
