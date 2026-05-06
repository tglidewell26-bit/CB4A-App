import { anthropic, CLAUDE_MODEL } from "./anthropic.js";
import { logger } from "../lib/logger.js";
import {
  CHARACTER_DATABASE_SYSTEM_PROMPT,
  buildCharacterDatabaseUserPrompt,
} from "../prompts/characterDatabasePrompt.js";
import type { BookCharacterDatabase } from "../generation/templateRenderers.js";

export type { BookCharacterDatabase } from "../generation/templateRenderers.js";

export function emptyCharacterDatabase(title: string, author: string, grade: number): BookCharacterDatabase {
  return {
    book_title: title.trim(),
    author: author.trim(),
    grade_level: grade,
    characters: [],
  };
}

export function normalizeCharacterDatabase(
  raw: unknown,
  title: string,
  author: string,
  grade: number,
): BookCharacterDatabase {
  const fallback = emptyCharacterDatabase(title, author, grade);
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as { characters?: unknown };
  if (!Array.isArray(candidate.characters)) return fallback;

  const characters = candidate.characters
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const parsed = item as { canonical_name?: unknown; aliases?: unknown };
      if (typeof parsed.canonical_name !== "string") return null;
      if (!Array.isArray(parsed.aliases) || !parsed.aliases.every((a) => typeof a === "string")) return null;
      const canonical_name = parsed.canonical_name.trim();
      const aliases = [...new Set(parsed.aliases.map((a) => a.trim()).filter(Boolean))];
      if (!canonical_name || aliases.length === 0) return null;
      return { canonical_name, aliases };
    })
    .filter((c): c is { canonical_name: string; aliases: string[] } => c !== null);

  return {
    book_title: title.trim(),
    author: author.trim(),
    grade_level: grade,
    characters,
  };
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(withoutFence);
}

export async function buildCharacterDatabase(
  title: string,
  author: string,
  grade: number,
): Promise<BookCharacterDatabase> {
  const fallback = emptyCharacterDatabase(title, author, grade);
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: CHARACTER_DATABASE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCharacterDatabaseUserPrompt(title, author, grade) }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (!text) return fallback;
    const parsed = parseJsonText(text);
    return normalizeCharacterDatabase(parsed, title, author, grade);
  } catch (err) {
    logger.warn({ err, title, author }, "Character database lookup failed; using empty list fallback.");
    return fallback;
  }
}
