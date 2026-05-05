import { gradeGuidanceFor } from "./gradeGuidance.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import { formatStandardsForPrompt } from "../standards/index.js";
import type { GradeLevel } from "../standards/types.js";

const QUESTION_TYPES = [
  "comprehension",
  "inference",
  "analysis",
  "evaluation",
  "vocabulary and inference",
] as const;

export function buildTeacherSectionSystemPrompt(args: {
  sectionKey: string;
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: GradeLevel;
  vocabulary: VocabularyWord[];
  sectionDisplayTitle: string;
  workbookContext: Record<string, string>;
  chapterText: string;
}): string {
  const guidance = gradeGuidanceFor(args.grade);
  return `You are writing the ${args.sectionDisplayTitle} section of a Teacher Guide for ${args.bookTitle} by ${args.author}.
${guidance}

Use only the provided chapter text and workbook context.
Return ONLY valid JSON.`;
}

export function buildTeacherSectionUserPrompt(args: {
  sectionKey: string;
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: GradeLevel;
  vocabulary: VocabularyWord[];
  sectionDisplayTitle: string;
  workbookContext: Record<string, string>;
  chapterText: string;
}): string {
  const context = Object.entries(args.workbookContext)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `Section: ${args.sectionKey}
Title: ${args.sectionDisplayTitle}
Book: ${args.bookTitle}
Author: ${args.author}
Chapter: ${args.chapterLabel}
Pages: ${args.pages}

Workbook context:
${context || "(none)"}

Chapter text:
${args.chapterText}

Vocabulary:
${args.vocabulary.map((v) => `${v.word} — ${v.book_quote}`).join("\n")}

${teacherSectionRequirementByKey(args.sectionKey, args.grade)}`;
}

export function teacherSectionRequirementByKey(key: string, grade?: GradeLevel): string {
  const gradeLevel = (grade ?? 4) as GradeLevel;
  switch (key) {
    case "measurable_objectives":
      return `Return a JSON object with this exact shape and nothing else:

{
  "objectives": [
    { "text": "identify the main character and their motivation", "standardCode": "RL.${gradeLevel}.3" },
    { "text": "describe the chapter's setting using text evidence", "standardCode": "RL.${gradeLevel}.1" }
  ]
}

Rules:
- Write 5–6 objectives.
- Each "standardCode" must be an exact grade-${gradeLevel} ELA code from the standards block below.
- Do not include any markdown, headings, or explanations.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "standards": {
      const standardsBlock = formatStandardsForPrompt(gradeLevel);
      return `Return a JSON object with this exact shape and nothing else:

{
  "standards": [
    { "code": "RL.${gradeLevel}.1" },
    { "code": "W.${gradeLevel}.3" }
  ]
}

Rules:
- Pick the standards this chapter actually addresses. Coverage must include at least:
  - one to three Reading standard (RL.${gradeLevel}.* or RI.${gradeLevel}.*)
  - one to three Writing standard (W.${gradeLevel}.*)
  - one to three Reading Language standard (L.${gradeLevel}.*) — vocabulary mini-lesson maps here
  - one to three Reading Speaking and Listening standard (SL.${gradeLevel}.*) — discussion maps here
- Each "code" must be an exact grade-${gradeLevel} code from the standards block below. Do NOT invent codes.
- Standard descriptions are filled in from a code lookup table — do NOT include description text.

Available standards (use ONLY these — do not invent codes):
${standardsBlock}

Return ONLY the JSON object. No markdown fences, no commentary.`;
    }

    case "get_ready_to_read":
      return `Return a JSON object with this exact shape and nothing else:

{
  "quickWritePrompt": "What might a character think or feel in this situation?",
  "implementationSteps": [
    "Display the prompt.",
    "Give students 2–3 quiet writing minutes.",
    "Invite turn-and-talk partners."
  ],
  "connectionTip": "This activates prior knowledge before close reading."
}

Rules:
- quickWritePrompt must be a single open-ended question.
- implementationSteps must have 4–5 short steps.
- connectionTip must be one concise sentence.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "words_to_know_mini_lesson":
      return `Return a JSON object with this exact shape and nothing else:

{
  "workedWord": "scrambled",
  "workedQuote": "She scrambled up the path.",
  "workedPage": 12,
  "contextClueStrategy": "Use the verbs around the word and the action in the sentence.",
  "studentDefinition": "moved quickly using hands and feet",
  "vocabularyTip": "Have students gesture the word and explain the clue."
}

Rules:
- Use one real vocabulary word from the chapter.
- Quote must be an exact quote from the chapter.
- workedPage must be the page number where the quote appears.
- Keep each field concise and student-friendly.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "guided_reading":
      return `Return a JSON object with this exact shape and nothing else:

{
  "sections": [
    {
      "pageStart": 1,
      "pageEnd": 3,
      "openingPhrase": "...",
      "closingPhrase": "...",
      "questions": [
        { "text": "What is happening here?", "questionType": "comprehension" },
        { "text": "What does this suggest?", "questionType": "inference" }
      ]
    }
  ],
  "readAloudTip": "Pause after each section and ask students to explain their thinking."
}

Question types must be one of: ${QUESTION_TYPES.join(", ")}.
- Use 3–5 sections.
- Each section needs 2–4 questions.
- openingPhrase and closingPhrase must be exact phrases from the chapter.
- readAloudTip must be one short teacher tip.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "think_about_the_story_answers":
      return `Return a JSON object with this exact shape and nothing else:

{
  "answers": [
    { "question": "Who is the main character?", "answer": "...", "page": 3 }
  ],
  "inferentialPrompts": [
    "Why do you think ...?",
    "What might ... suggest?"
  ],
  "tieredDiscussion": {
    "literal": ["..."],
    "inference": ["..."],
    "analysis": ["..."],
    "evaluation": ["..."]
  },
  "analyticalThinking": ["..."],
  "personalConnection": ["..."]
}

Rules:
- answers must mirror the workbook questions.
- inferentialPrompts should push beyond literal recall.
- tieredDiscussion must include all four tiers.
- analyticalThinking and personalConnection should each have 2–3 items.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "differentiated_supports":
      return `Return a JSON object with this exact shape and nothing else:

{
  "strugglingReaders": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  },
  "englishLanguageLearners": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  },
  "advancedStudents": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  }
}

Rules:
- Each list should be short, practical, and classroom-ready.
- Do not add any extra keys.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "common_student_questions":
      return `Return a JSON object with this exact shape and nothing else:

{
  "questions": [
    { "studentQ": "Why did the character do that?", "teacherA": "...", "page": 4 }
  ]
}

Rules:
- Write 5–8 common student questions.
- teacherA should be concise and helpful.
- page is optional if there is no direct citation.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "creative_response_common_errors":
      return `Return a JSON object with this exact shape and nothing else:

{
  "characterName": "Heidi",
  "errors": {
    "noSpecificDetails": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "breakingCharacter": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "retelling": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "noEvidence": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "modernLanguage": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    }
  }
}

Rules:
- Provide one short paragraph, one weak example, and one how-to-fix tip for each error.
- characterName should be the main character's name.
- Keep language concrete and teacher-friendly.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "exit_ticket":
      return `Return a JSON object with this exact shape and nothing else:

{
  "prompt": "Predict what will happen next chapter, and explain why using a detail from the text.",
  "successCriteria": [
    "Makes a prediction",
    "Uses text evidence",
    "Explains the thinking with because"
  ],
  "strongExample": "...",
  "developingExample": "..."
}

Rules:
- The prompt must ask students to PREDICT what will happen next, not summarize the chapter.
- successCriteria must contain exactly 3 clear observable criteria.
- strongExample and developingExample should each be 2–3 sentences.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "answer_key":
      return `Return a JSON object with this exact shape and nothing else:

{
  "readingBetweenTheLines": [
    { "question": "...", "answer": "...", "page": 4 }
  ],
  "digDeeper": [
    { "question": "...", "answer": "...", "page": 5 }
  ],
  "multipleChoice": [
    { "question": "...", "correctLetter": "B", "rationale": "..." }
  ],
  "evidenceFromTheStory": [
    { "question": "...", "sampleAnswer": "...", "quote": "...", "page": 6 }
  ],
  "characterChart": [
    { "characterName": "...", "description": "...", "whatThisShows": "...", "quote": "...", "page": 7 }
  ],
  "drawItDetails": ["...", "...", "..."]
}

Rules:
- Use the workbook context provided to answer only the questions that appear in the workbook.
- For multipleChoice, read the full question + options and return the correct letter plus a short rationale.
- drawItDetails must be 3–5 concrete visual details.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    default:
      throw new Error(`Unknown teacher guide section key: ${key}`);
  }
}
