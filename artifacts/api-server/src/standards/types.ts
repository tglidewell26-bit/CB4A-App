export type GradeLevel = 3 | 4 | 5 | 6 | 7 | 8;

export type StandardStrand = "RL" | "RI" | "W";

export type CurriculumUse =
  | "think_about_the_story"
  | "reading_between_the_lines"
  | "dig_deeper"
  | "vocabulary"
  | "evidence_from_the_story"
  | "creative_response"
  | "character_analysis"
  | "multiple_choice";

export interface ELAStandard {
  code: string;
  strand: StandardStrand;
  grade: GradeLevel;
  number: string;
  subNumber?: string;
  text: string;
  useFor: CurriculumUse[];
}

export interface FolderStandardsProfile {
  grade: GradeLevel;
  standardsRef: string;
  rl: ELAStandard[];
  ri: ELAStandard[];
  w: ELAStandard[];
}
