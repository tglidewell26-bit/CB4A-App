import { standardsByGradeAndStrand } from "./elaStandards.js";
import type { CurriculumUse, ELAStandard, FolderStandardsProfile, GradeLevel, StandardStrand } from "./types.js";

export type { CurriculumUse, ELAStandard, FolderStandardsProfile, GradeLevel, StandardStrand };

export function getStandardsForGrade(
  grade: GradeLevel,
  strand: StandardStrand,
): ELAStandard[] {
  return standardsByGradeAndStrand(grade, strand);
}

export function getStandardsForFolder(
  grade: GradeLevel,
  useFor: CurriculumUse,
): ELAStandard[] {
  const all: ELAStandard[] = [
    ...standardsByGradeAndStrand(grade, "RL"),
    ...standardsByGradeAndStrand(grade, "RI"),
    ...standardsByGradeAndStrand(grade, "W"),
    ...standardsByGradeAndStrand(grade, "L"),
    ...standardsByGradeAndStrand(grade, "SL"),
  ];
  return all.filter((s) => s.useFor.includes(useFor));
}

export function createStandardsProfileForFolder(grade: GradeLevel): FolderStandardsProfile {
  return {
    grade,
    standardsRef: `ela-ca-ccss-grade-${grade}`,
    rl: standardsByGradeAndStrand(grade, "RL"),
    ri: standardsByGradeAndStrand(grade, "RI"),
    w: standardsByGradeAndStrand(grade, "W"),
    l: standardsByGradeAndStrand(grade, "L"),
    sl: standardsByGradeAndStrand(grade, "SL"),
  };
}

const STRAND_HEADERS: Array<{ strand: StandardStrand; label: string }> = [
  { strand: "RL", label: "Reading Literature (RL)" },
  { strand: "RI", label: "Reading Informational Text (RI)" },
  { strand: "W", label: "Writing (W)" },
  { strand: "L", label: "Language (L)" },
  { strand: "SL", label: "Speaking and Listening (SL)" },
];

export function formatStandardsForPrompt(
  grade: GradeLevel,
  includeSubstandards = false,
): string {
  const lines: string[] = [`California Common Core ELA Standards — Grade ${grade}`, ""];

  for (const { strand, label } of STRAND_HEADERS) {
    const items = standardsByGradeAndStrand(grade, strand).filter(
      (s) => !s.subNumber || includeSubstandards,
    );
    if (items.length === 0) continue;
    lines.push(`${label}:`);
    for (const s of items) {
      lines.push(`  ${s.code}: ${s.text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
