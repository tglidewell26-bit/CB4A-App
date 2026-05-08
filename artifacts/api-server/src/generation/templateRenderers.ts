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
    case "creative_response":
      return `<div class="creative-template">
  <p>Dear [recipient],</p>
  ${blankWritingLines(12)}
  <p>Sincerely,</p>
  <p>[name]</p>
</div>`;
    case "writing_rubric":
      return `<table class="rubric-table">
  <thead><tr><th>Category</th><th>4 Points</th><th>3 Points</th><th>2 Points</th><th>1 Point</th><th>My Score</th></tr></thead>
  <tbody>
    ${Array(6).fill("<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("\n    ")}
  </tbody>
</table>`;
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
      const events = [...llmBodyHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
        .map((m) => m[1].trim())
        .slice(0, 7);
      const shuffled = shuffleArray(events);
      if (shuffled.length !== 7) {
        throw new Error("Student Workbook validation failed: bonus_challenge requires exactly 7 events from LLM.");
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
