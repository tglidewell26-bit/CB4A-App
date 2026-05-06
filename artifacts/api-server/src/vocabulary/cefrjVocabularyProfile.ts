const CEFRJ_LEVEL_ORDER = [
  "A1_1",
  "A1_2",
  "A1_3",
  "A2_1",
  "A2_2",
  "B1_1",
  "B1_2",
  "B2_1",
  "B2_2",
] as const;

export type CefrJLevel = (typeof CEFRJ_LEVEL_ORDER)[number];

const CEFRJ_LEXICON: Record<string, CefrJLevel> = {
  go: "A1_1",
  ask: "A1_1",
  move: "A1_2",
  walk: "A1_1",
  run: "A1_1",
  jump: "A1_1",
  make: "A1_1",
  get: "A1_1",
  give: "A1_1",
  take: "A1_1",
  look: "A1_1",
  know: "A1_1",
  think: "A1_2",
  call: "A1_1",
  play: "A1_1",
  work: "A1_2",
  start: "A1_2",
  stop: "A1_2",
  help: "A1_1",
  want: "A1_1",
  need: "A1_2",
  try: "A1_2",
  feel: "A1_2",
  home: "A1_1",
  house: "A1_1",
  school: "A1_1",
  friend: "A1_1",
  family: "A1_2",
  mother: "A1_1",
  father: "A1_1",
  brother: "A1_1",
  sister: "A1_1",
  teacher: "A1_2",
  student: "A1_2",
  animal: "A1_2",
  water: "A1_1",
  food: "A1_1",
  happy: "A1_2",
  sad: "A1_2",
  big: "A1_1",
  small: "A1_1",
  long: "A1_1",
  short: "A1_1",
  good: "A1_1",
  bad: "A1_1",
  early: "A1_2",
  late: "A1_2",
  thing: "A1_1",
  people: "A1_2",
  child: "A1_2",
  children: "A1_2",
  year: "A1_1",
  day: "A1_1",
  time: "A1_1",
  place: "A1_2",
  world: "A1_2",
};

function cefrJIndex(level: CefrJLevel): number {
  return CEFRJ_LEVEL_ORDER.indexOf(level);
}

function knownByGradeLevel(gradeLevel: number): CefrJLevel {
  if (gradeLevel <= 1) return "A1_1";
  if (gradeLevel <= 3) return "A1_3";
  if (gradeLevel <= 5) return "A2_1";
  if (gradeLevel <= 8) return "A2_2";
  return "B1_1";
}

export function isLikelyKnownByGrade(lemma: string, gradeLevel: number): boolean {
  const level = CEFRJ_LEXICON[lemma.toLowerCase()];
  if (!level) return false;
  return cefrJIndex(level) <= cefrJIndex(knownByGradeLevel(gradeLevel));
}
