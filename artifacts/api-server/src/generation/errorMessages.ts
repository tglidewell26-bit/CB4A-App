/**
 * Maps internal generation errors to a teacher-facing message. Falls back to
 * the raw message so we never hide useful diagnostic information.
 */
export function friendlyGenerationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/missing the ".*" delimiter|delimiters are out of order/i.test(raw)) {
    return "The AI returned an incomplete response (a section delimiter was missing). This is usually a transient issue — try again.";
  }

  if (/validation failed/i.test(raw)) {
    return "The generated content didn't match the required structure. Try again, or report this if it keeps happening.";
  }

  if (/words_to_know must output/i.test(raw)) {
    return "The AI didn't format the Words to Know section correctly. Try again — this usually resolves on a retry.";
  }

  if (/(rate.?limit|429|overloaded|timeout|ECONNRESET|fetch failed|network)/i.test(raw)) {
    return "Couldn't reach the AI service. Wait a moment and try again.";
  }

  return `Generation failed: ${raw}`;
}
