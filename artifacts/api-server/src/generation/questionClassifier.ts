// Higher-order question detection used by the workbook validators.
//
// Uses a POSITIVE pattern set: a question is "higher order" when it
// explicitly requests inference, analysis, comparison, or interpretive
// reasoning; a question is "clearly literal" when it only asks for
// recalled facts.
//
// Validation policy:
//   think_about_the_story  — throws (hard error) if a higher-order pattern
//                            is detected; offending question text included.
//   reading_between_the_lines / dig_deeper — warns only when a question
//                            reads as clearly literal.

const HIGHER_ORDER_PATTERNS: RegExp[] = [
  /\bwhy do you think\b/i,
  /\bwhy might\b/i,
  /\bwhy would\b/i,
  /\bwhy does the author\b/i,
  /\bwhat do you think\b/i,
  /\bwhat does this (?:show|reveal|suggest|tell us)\b/i,
  /\bwhat can you infer\b/i,
  /\bwhat clues\b/i,
  /\bhow do you know\b/i,
  /\bhow does this (?:show|connect|reveal)\b/i,
  /\bhow does the author\b/i,
  /\bcompare\b/i,
  /\bcontrast\b/i,
  /\bsymboli[sz]e\b/i,
  /\brepresent\b/i,
  /\btheme\b/i,
  /\bauthor['’]s purpose\b/i,
  /\bwhat (?:is|are) the (?:significance|meaning|impact|effect|consequences|relationship)\b/i,
  /\bwhat (?:lesson|message)\b/i,
  /\bwhat can we (?:learn|conclude)\b/i,
  /\bwhy is this important\b/i,
  /\binfer\b/i,
  /\bmotivat/i,
  /\breaction\b/i,
  /\bemotion\b/i,
  /\bfeel(?:s|ing)?\b/i,
];

const CLEARLY_LITERAL_PATTERNS: RegExp[] = [
  /^\s*who\s/i,
  /^\s*what\s/i,
  /^\s*when\s/i,
  /^\s*where\s/i,
  /\baccording to the text\b/i,
  /\bin the story\b/i,
  /\bhappened\b/i,
  /\bdid\b/i,
];

export function isHigherOrderQuestion(question: string): boolean {
  return HIGHER_ORDER_PATTERNS.some((rx) => rx.test(question));
}

export function isClearlyLiteralQuestion(question: string): boolean {
  if (isHigherOrderQuestion(question)) return false;
  return CLEARLY_LITERAL_PATTERNS.some((rx) => rx.test(question));
}
