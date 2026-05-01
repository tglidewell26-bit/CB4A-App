export type BodySource = "llm" | "manual" | "template";

export interface SectionSchemaEntry {
  key: string;
  display_title: string;
  standing_subheader: string | null;
  body_source: BodySource;
  required: boolean;
}

export interface TeacherGuideSectionSchemaEntry extends SectionSchemaEntry {
  tip_slots: number;
}

export const QUESTION_TYPE_TAGS = [
  "comprehension",
  "inference",
  "analysis",
  "evaluation",
  "vocabulary and inference",
] as const;

export const STUDENT_WORKBOOK_SECTIONS: SectionSchemaEntry[] = [
  {
    key: "get_ready_to_read",
    display_title: "Get Ready to Read",
    standing_subheader: null,
    body_source: "llm",
    required: true,
  },
  {
    key: "words_to_know",
    display_title: "Words to Know",
    standing_subheader: "Use the chapter to find each word and complete the chart below.",
    body_source: "llm",
    required: true,
  },
  {
    key: "think_about_the_story",
    display_title: "Think About the Story",
    standing_subheader: "Use the chapter to answer the questions below.",
    body_source: "llm",
    required: true,
  },
  {
    key: "reading_between_the_lines",
    display_title: "Reading Between the Lines",
    standing_subheader: null,
    body_source: "llm",
    required: true,
  },
  {
    key: "dig_deeper",
    display_title: "Dig Deeper",
    standing_subheader: null,
    body_source: "llm",
    required: true,
  },
  {
    key: "multiple_choice_questions",
    display_title: "Multiple Choice Questions",
    standing_subheader: "Circle the letter next to the correct answer to each question.",
    body_source: "llm",
    required: true,
  },
  {
    key: "evidence_from_the_story",
    display_title: "Evidence from the Story",
    standing_subheader: "Use complete sentences and include evidence from the text with page numbers.",
    body_source: "llm",
    required: true,
  },
  {
    key: "creative_response",
    display_title: "Creative Response",
    standing_subheader: null,
    body_source: "template",
    required: true,
  },
  {
    key: "writing_rubric",
    display_title: "Writing Rubric",
    standing_subheader: "Use the rubric below to score your [creative response noun].",
    body_source: "template",
    required: true,
  },
  {
    key: "character_chart",
    display_title: "Character Chart",
    standing_subheader: "Fill in the chart below for the main characters in Chapter [N].",
    body_source: "template",
    required: true,
  },
  {
    key: "draw_it",
    display_title: "Draw It!",
    standing_subheader: null,
    body_source: "template",
    required: true,
  },
  {
    key: "reflect_on_your_drawing",
    display_title: "Reflect on Your Drawing",
    standing_subheader: "Complete these sentence stems based on your drawing and what you learned.",
    body_source: "template",
    required: true,
  },
  {
    key: "bonus_challenge",
    display_title: "Bonus Challenge—Follow the Story",
    standing_subheader: "Put these events from Chapter [N] in the correct order by numbering them 1-7.",
    body_source: "template",
    required: true,
  },
  {
    key: "thinking_deeper",
    display_title: "Thinking Deeper",
    standing_subheader: "What do you think will happen in the next chapter? Make a prediction based on what you learned in Chapter [N].",
    body_source: "template",
    required: true,
  },
];

export const TEACHER_GUIDE_SECTIONS: TeacherGuideSectionSchemaEntry[] = [
  {
    key: "lesson_overview",
    display_title: "Lesson Overview",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 1,
  },
  {
    key: "standards",
    display_title: "Standards",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "measurable_objectives",
    display_title: "Measurable Objectives",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "get_ready_to_read",
    display_title: "Get Ready to Read",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "words_to_know_mini_lesson",
    display_title: "Words to Know mini-lesson",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "guided_reading",
    display_title: "Guided Reading with pause points",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 1,
  },
  {
    key: "tiered_discussion",
    display_title: "Tiered Discussion",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "answers_aligned_to_workbook_pages",
    display_title: "Answers aligned to workbook pages",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "support_for_diverse_learners",
    display_title: "Struggling Readers / ELL / Advanced Students support",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "common_student_questions",
    display_title: "Common student questions",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
  {
    key: "creative_response_common_errors",
    display_title: "Creative Response common errors",
    standing_subheader: null,
    body_source: "llm",
    required: true,
    tip_slots: 0,
  },
];
