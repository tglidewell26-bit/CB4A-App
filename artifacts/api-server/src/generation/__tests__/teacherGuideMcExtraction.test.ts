import { describe, expect, it } from "vitest";
import { extractMultipleChoiceItems } from "../teacherGuide.js";

describe("extractMultipleChoiceItems", () => {
  const sample = `<div class="mc-item">
  <div class="question">Why does Heidi go up the mountain?</div>
  <ul class="mc-options">
    <li>A. To herd goats</li>
    <li>B. To live with Grandfather</li>
    <li>C. To pick flowers</li>
    <li>D. To visit Peter</li>
  </ul>
</div>
<div class="mc-item">
  <div class="question">Who walks Heidi up the path?</div>
  <ul class="mc-options">
    <li>A. Peter</li>
    <li>B. Deta</li>
    <li>C. Grandfather</li>
    <li>D. The doctor</li>
  </ul>
</div>`;

  it("captures the full mc-item block including options for every item", () => {
    const result = extractMultipleChoiceItems(sample);
    expect(result).toContain("Why does Heidi go up the mountain?");
    expect(result).toContain("A. To herd goats");
    expect(result).toContain("D. To visit Peter");
    expect(result).toContain("Who walks Heidi up the path?");
    expect(result).toContain("B. Deta");
    const itemCount = (result.match(/<div class="mc-item">/g) ?? []).length;
    expect(itemCount).toBe(2);
  });

  it("falls back to question-only extraction when no mc-item blocks exist", () => {
    const fallback = `<div class="question">Just a question</div>`;
    const result = extractMultipleChoiceItems(fallback);
    expect(result).toContain("Just a question");
  });

  it("returns empty string for empty input", () => {
    expect(extractMultipleChoiceItems("")).toBe("");
  });
});
