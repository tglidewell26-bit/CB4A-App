export interface StudentWorkbookSectionSchema {
  id: string;
  displayTitle: string;
  standingSubheader: string | null;
  bodySource: "llm" | "manual";
}

export interface TeacherGuideSectionSchema {
  id: string;
  displayTitle: string;
  tipSlots: number;
  bodySource: "llm" | "manual";
}

export const STUDENT_WORKBOOK_SECTIONS: StudentWorkbookSectionSchema[] = [
  {
    id: "get_ready_to_read",
    displayTitle: "Get Ready to Read",
    standingSubheader: "FOCUS QUESTION",
    bodySource: "llm",
  },
  {
    id: "words_to_know",
    displayTitle: "Words to Know",
    standingSubheader: "Use the chapter to find each word and complete the chart below.",
    bodySource: "llm",
  },
  {
    id: "think_about_the_story",
    displayTitle: "Think About the Story",
    standingSubheader: "Use the chapter to answer the questions below.",
    bodySource: "llm",
  },
  { id: "reading_between_the_lines", displayTitle: "Reading Between the Lines", standingSubheader: null, bodySource: "llm" },
  { id: "dig_deeper", displayTitle: "Dig Deeper", standingSubheader: null, bodySource: "llm" },
  { id: "evidence_from_the_story", displayTitle: "Evidence from the Story", standingSubheader: null, bodySource: "llm" },
  { id: "multiple_choice", displayTitle: "Multiple Choice", standingSubheader: null, bodySource: "llm" },
  {
    id: "creative_response",
    displayTitle: "Creative Response",
    standingSubheader: "Use the sentence stems below to write your response.",
    bodySource: "llm",
  },
  { id: "writing_rubric", displayTitle: "Writing Rubric", standingSubheader: null, bodySource: "llm" },
  {
    id: "character_chart",
    displayTitle: "Character Chart",
    standingSubheader: "Fill in the chart using evidence from the text.",
    bodySource: "llm",
  },
  {
    id: "draw_it",
    displayTitle: "Draw It",
    standingSubheader: "Draw a scene from the chapter below.",
    bodySource: "llm",
  },
  {
    id: "reflect_on_your_drawing",
    displayTitle: "Reflect on Your Drawing",
    standingSubheader: "Use these sentence stems based on your drawing and the chapter.",
    bodySource: "llm",
  },
  {
    id: "bonus_challenge",
    displayTitle: "Bonus Challenge-Follow the Story",
    standingSubheader: "Put these events from Chapter [N] in the correct order by numbering them 1-[count].",
    bodySource: "llm",
  },
  {
    id: "thinking_deeper",
    displayTitle: "Thinking Deeper",
    standingSubheader:
      "What do you think will happen in the next chapter? Make a prediction based on what you learned in Chapter [N].",
    bodySource: "llm",
  },
];

export const TEACHER_GUIDE_SECTIONS: TeacherGuideSectionSchema[] = [
  { id: "lesson_overview", displayTitle: "Lesson Overview", tipSlots: 2, bodySource: "llm" },
  { id: "words_to_know_teacher", displayTitle: "Words to Know", tipSlots: 0, bodySource: "llm" },
  { id: "guided_reading", displayTitle: "Guided Reading", tipSlots: 1, bodySource: "llm" },
  { id: "think_about_the_story_teacher", displayTitle: "Think About the Story", tipSlots: 1, bodySource: "llm" },
  { id: "reading_dig_deeper_teacher", displayTitle: "Reading Dig Deeper", tipSlots: 0, bodySource: "llm" },
  { id: "multiple_choice_teacher", displayTitle: "Multiple Choice", tipSlots: 0, bodySource: "llm" },
  { id: "evidence_teacher", displayTitle: "Evidence from the Story", tipSlots: 0, bodySource: "llm" },
  { id: "creative_response_teacher", displayTitle: "Creative Response", tipSlots: 0, bodySource: "llm" },
  { id: "character_chart_teacher", displayTitle: "Character Chart", tipSlots: 0, bodySource: "llm" },
  { id: "draw_it_teacher", displayTitle: "Draw It", tipSlots: 0, bodySource: "llm" },
  { id: "thinking_deeper_exit_ticket", displayTitle: "Thinking Deeper / Exit Ticket", tipSlots: 0, bodySource: "llm" },
];

export const QUESTION_TYPE_TAGS = [
  "comprehension",
  "inference",
  "analysis",
  "evaluation",
  "vocabulary and inference",
] as const;

export const DIFFERENTIATION_BLOCKS = ["Struggling readers", "English language learners", "Advanced students"] as const;

export const READING_STAGES = ["Before reading", "During reading", "After reading"] as const;

export const TIERED_DISCUSSION_TIERS = ["Literal comprehension", "Inferential thinking", "Analytical thinking"] as const;

export const EXAMPLE_RESPONSE_TIERS = ["Strong", "Developing", "Needs evidence added"] as const;

export const STANDARDS_SUBHEADERS = ["Reading literature", "Language", "Speaking and listening", "Writing"] as const;

export const WORDS_TO_KNOW_ACTIVITIES = ["Introduce words with context", "Partner practice", "Quick check"] as const;
