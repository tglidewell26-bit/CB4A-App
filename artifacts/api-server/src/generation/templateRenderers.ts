import type { VocabularyWord } from "../vocabulary/types.js";

export interface BookCharacterDatabase {
  book_title: string;
  author: string;
  grade_level: number;
  characters: { canonical_name: string; aliases: string[] }[];
}

export interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
  characterDatabase?: BookCharacterDatabase;
  /**
   * Number of book chapters covered by this lesson. Defaults to 1 when not
   * provided; callers can set it explicitly, or use getLessonChapterCount() to
   * infer it from chapterTitle patterns like "Chapters 2-3" / "Chapters 4 and 5".
   */
  chapterCount?: number;
}

/**
 * Returns the number of book chapters covered by this lesson.
 *
 * Resolution order:
 *   1. Explicit meta.chapterCount, when set and > 0.
 *   2. Parse chapterTitle for a range like "Chapters 2-3", "Chapters 2–3",
 *      "Chapters 2 to 3" → end - start + 1.
 *   3. Parse chapterTitle for a list like "Chapters 2 and 3",
 *      "Chapters 2 & 3", "Chapters 2, 3, 4" → number of distinct integers.
 *   4. Fallback: 1 (single-chapter lesson).
 */
export function getLessonChapterCount(meta: Pick<ChapterMeta, "chapterTitle" | "chapterCount">): number {
  if (typeof meta.chapterCount === "number" && meta.chapterCount > 0) {
    return Math.trunc(meta.chapterCount);
  }
  const title = meta.chapterTitle ?? "";
  // Accept "Chapter(s)", "Ch", "Chs", and "Lesson(s)" as prefixes — partners
  // commonly title multi-chapter lessons as "Lesson 1-2", "Chs 3 & 4", etc.
  const prefix = String.raw`(?:Chapters?|Chs?|Lessons?)`;
  const rangeRe = new RegExp(
    `${prefix}\\s+(\\d+)\\s*(?:[-–—]|to|through|thru)\\s*(\\d+)`,
    "i",
  );
  const range = title.match(rangeRe);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (b >= a) return b - a + 1;
  }
  const listRe = new RegExp(`${prefix}\\s+([\\d,&\\s]+(?:and\\s+\\d+)?)`, "i");
  const listMatch = title.match(listRe);
  if (listMatch) {
    const nums = [...listMatch[1].matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
    const unique = Array.from(new Set(nums));
    if (unique.length >= 2) return unique.length;
  }
  return 1;
}

/**
 * Acceptable range of bonus_challenge events for a lesson:
 *   - 1-chapter lesson  → 6–7 events (canonical Lesson 1 uses 7; partner spec
 *     said "6", so we accept either rather than forcing one).
 *   - 2+ chapter lesson → exactly 10 events.
 */
export interface BonusChallengeEventRange {
  min: number;
  max: number;
}

export function getBonusChallengeEventRange(chapterCount: number): BonusChallengeEventRange {
  return chapterCount >= 2 ? { min: 10, max: 10 } : { min: 6, max: 7 };
}

/**
 * Maximum bonus_challenge events for a lesson. Used as the upper bound when
 * slicing LLM output. The lower bound is enforced separately via
 * getBonusChallengeEventRange().min in the validator.
 */
export function getBonusChallengeEventCount(chapterCount: number): number {
  return getBonusChallengeEventRange(chapterCount).max;
}

/**
 * Per-chapter scaling rules for the five core student-workbook question
 * sections, derived from the canonical Heidi lessons:
 *   - think_about_the_story          : fixed 6 (does not scale)
 *   - reading_between_the_lines      : 3 × chapterCount  (Ch 1: 3, Chs 2-3: 6)
 *   - multiple_choice_questions      : 3 × chapterCount  (Ch 1: 3, Chs 2-3: 6)
 *   - dig_deeper                     : 3 + 2·(chapterCount-1)  (Ch 1: 3, Chs 2-3: 5)
 *   - evidence_from_the_story        : 3 + 2·(chapterCount-1)  (Ch 1: 3, Chs 2-3: 5)
 */
export interface CoreQuestionItemCounts {
  think_about_the_story: number;
  reading_between_the_lines: number;
  dig_deeper: number;
  multiple_choice_questions: number;
  evidence_from_the_story: number;
}

export function getCoreQuestionItemCounts(chapterCount: number): CoreQuestionItemCounts {
  const cc = Math.max(1, Math.trunc(chapterCount));
  return {
    think_about_the_story: 6,
    reading_between_the_lines: 3 * cc,
    dig_deeper: 3 + 2 * (cc - 1),
    multiple_choice_questions: 3 * cc,
    evidence_from_the_story: 3 + 2 * (cc - 1),
  };
}

export interface GeneratedSection {
  key: string;
  displayTitle: string;
  standingSubheader: string | null;
  bodySource: "llm" | "manual" | "template";
  bodyHtml: string;
  tipSlots?: number;
}

export function truncateText(text: string, maxChars = 80000): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Text truncated for length]`;
}

export function getChapterLabel(meta: ChapterMeta): string {
  return meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;
}

export function buildManualSlot(sectionName: string): string {
  return `<!-- MANUAL: ${sectionName} -->`;
}

function blankWritingLines(count = 10): string {
  return Array(count).fill('<div class="blank-line">_____</div>').join("\n");
}

export function buildWordsToKnowTableHtml(vocabulary: VocabularyWord[]): string {
  const rows = vocabulary
    .map(
      (v) => `<tr>
  <td>${v.word}</td>
  <td>__________________________________________</td>
  <td>"${v.book_quote}" (p.${v.page_number})</td>
  <td>__________________________________________</td>
</tr>`,
    )
    .join("\n");

  return `<table class="rubric-table">
  <thead>
    <tr>
      <th>Word</th>
      <th>Definition using context clues</th>
      <th>Sentence from book with page number</th>
      <th>My own sentence</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`;
}

export function getChapterCharacterNames(meta: ChapterMeta): string[] {
  const db = meta.characterDatabase;
  if (!db?.characters?.length) return [];
  const text = meta.extractedText.toLowerCase();
  const scored = db.characters.map((character) => {
    const aliases = [character.canonical_name, ...character.aliases];
    const mentionCount = aliases.reduce((sum, alias) => {
      const rx = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&").toLowerCase()}\\b`, "g");
      return sum + (text.match(rx)?.length ?? 0);
    }, 0);
    return { name: character.canonical_name, mentionCount };
  });

  const aboveThreshold = scored.filter((c) => c.mentionCount > 2).map((c) => c.name);
  if (aboveThreshold.length > 0) return aboveThreshold;

  const fallback = scored
    .filter((c) => c.mentionCount > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 5)
    .map((c) => c.name);
  return fallback;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildTemplateSectionBody(
  sectionKey: string,
  llmBodyHtml: string,
  meta: ChapterMeta,
): string {
  switch (sectionKey) {
    case "creative_response": {
      const promptBlock = llmBodyHtml.trim()
        ? `<div class="creative-prompt">${llmBodyHtml}</div>\n  `
        : "";
      return `<div class="creative-template">
  ${promptBlock}<p>Dear [recipient],</p>
  ${blankWritingLines(12)}
  <p>Sincerely,</p>
  <p>[name]</p>
</div>`;
    }
    case "writing_rubric": {
      const chapterRef =
        typeof meta.chapterNum === "number" && Number.isFinite(meta.chapterNum)
          ? `Chapter ${meta.chapterNum}`
          : "the chapter";
      const criteria: Array<{ name: string; desc: string }> = [
        { name: "Prompt response", desc: "I answered what the prompt asked." },
        { name: "Details from the chapter", desc: `I included at least three details from ${chapterRef}.` },
        { name: "Character voice", desc: "I wrote in the voice of the character from the prompt." },
        { name: "Spelling and grammar", desc: "I checked my spelling and grammar." },
      ];
      const rows = criteria
        .map(
          (c) =>
            `<tr><td><strong>${c.name}</strong><br/>${c.desc}</td><td></td><td></td><td></td><td></td><td></td></tr>`,
        )
        .join("\n    ");
      return `<table class="rubric-table">
  <thead><tr><th>Category</th><th>4 Points</th><th>3 Points</th><th>2 Points</th><th>1 Point</th><th>My Score</th></tr></thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
    }
    case "character_chart": {
      const names = getChapterCharacterNames(meta);
      const rows = names.length > 0
        ? names.map((name) => `<tr><td>${name}</td><td></td><td></td></tr>`).join("\n")
        : `<tr><td>No major characters appear in this chapter</td><td></td><td></td></tr>`;
      return `<table class="character-chart">
  <thead>
    <tr><th>Character Name</th><th>What They Look Like and How They Act</th><th>What This Shows About Them</th></tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
    }
    case "draw_it":
      return `<div class="draw-it-template">
  <div class="draw-it-prompt">${llmBodyHtml}</div>
  <div class="drawing-box"></div>
</div>`;
    case "reflect_on_your_drawing":
      return `<ol class="reflect-stems">
  <li>In my drawing, ___ because ___.</li>
  <li>One detail I included is ___.</li>
  <li>I would add ___ because ___.</li>
</ol>`;
    case "thinking_deeper":
      return `<p>I predict that ________________________________________________</p>
<p>because _____________________________________________________.</p>`;
    case "bonus_challenge": {
      // Allow optional attributes on <li> (notably data-page="N") so the
      // upstream chronological-sort step can annotate events without breaking
      // this regex. The attribute is stripped here — students don't see it.
      //
      // Event count is range-based:
      //   - single-chapter lesson  → 6 or 7 events (accept either)
      //   - multi-chapter lesson   → exactly 10 events
      // The range max is used as the upper slice bound; the min is enforced
      // below so a too-short LLM response fails loudly.
      const cc = getLessonChapterCount(meta);
      const { min: minEvents, max: maxEvents } = getBonusChallengeEventRange(cc);
      const events = [...llmBodyHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
        .map((m) => m[1].trim())
        .slice(0, maxEvents);
      const shuffled = shuffleArray(events);
      if (shuffled.length < minEvents || shuffled.length > maxEvents) {
        const expectedDesc = minEvents === maxEvents ? `exactly ${maxEvents}` : `${minEvents}–${maxEvents}`;
        throw new Error(
          `Student Workbook validation failed: bonus_challenge requires ${expectedDesc} events from LLM (got ${shuffled.length}).`,
        );
      }
      return `<ol class="timeline-list">
  ${shuffled.map((event) => `<li>_____ ${event}</li>`).join("\n  ")}
</ol>`;
    }
    default:
      return llmBodyHtml;
  }
}

export function renderStudentWorkbookSection(section: GeneratedSection): string {
  const subheaderHtml = section.standingSubheader
    ? `\n  <p class="wb-instructions">${section.standingSubheader}</p>`
    : "";
  return `<div class="wb-section" data-section-key="${section.key}">
  <h2>${section.displayTitle}</h2>${subheaderHtml}
  ${section.bodyHtml}
</div>`;
}

export function renderTeacherGuideSection(section: GeneratedSection): string {
  const subheaderHtml = section.standingSubheader
    ? `\n  <p class="tg-instructions">${section.standingSubheader}</p>`
    : "";

  return `<div class="tg-section" data-section-key="${section.key}">
  <h2>${section.displayTitle}</h2>${subheaderHtml}
  ${section.bodyHtml}
</div>`;
}
