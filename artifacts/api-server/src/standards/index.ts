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
  const all = [
    ...standardsByGradeAndStrand(grade, "RL"),
    ...standardsByGradeAndStrand(grade, "RI"),
    ...standardsByGradeAndStrand(grade, "W"),
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
  };
}

export function formatStandardsForPrompt(
  grade: GradeLevel,
  includeSubstandards = false,
): string {
  const rl = standardsByGradeAndStrand(grade, "RL").filter(
    (s) => !s.subNumber || includeSubstandards,
  );
  const ri = standardsByGradeAndStrand(grade, "RI").filter(
    (s) => !s.subNumber || includeSubstandards,
  );
  const w = standardsByGradeAndStrand(grade, "W").filter(
    (s) => !s.subNumber || includeSubstandards,
  );

  const lines: string[] = [`California Common Core ELA Standards — Grade ${grade}`, ""];

  lines.push("Reading Literature (RL):");
  for (const s of rl) {
    lines.push(`  ${s.code}: ${s.text}`);
  }

  lines.push("");
  lines.push("Reading Informational Text (RI):");
  for (const s of ri) {
    lines.push(`  ${s.code}: ${s.text}`);
  }

  lines.push("");
  lines.push("Writing (W):");
  for (const s of w) {
    lines.push(`  ${s.code}: ${s.text}`);
  }

  return lines.join("\n");
}
