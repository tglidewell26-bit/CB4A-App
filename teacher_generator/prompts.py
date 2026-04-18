from typing import Any, Dict

GRADE_GUIDANCE: Dict[int, str] = {
    3: "Grade 3: concrete language, mostly literal comprehension, heavy scaffolds.",
    4: "Grade 4: clear language, some simple inference, explicit supports.",
    5: "Grade 5: balanced literal and inferential work, evidence-based responses.",
    6: "Grade 6: stronger inference and analysis, academic vocabulary with support.",
    7: "Grade 7: analytical reading, character motivation, theme, craft.",
    8: "Grade 8: sophisticated analysis, nuanced claims, strong textual evidence.",
}

_OUTPUT_FORMAT = """\
Return ONLY XML inside one <TEACHER_GUIDE> root tag. No markdown.

<TEACHER_GUIDE>
<LESSON_OVERVIEW>...</LESSON_OVERVIEW>
<MEASURABLE_OBJECTIVES>
<OBJECTIVE_1>Students will be able to ... (RL.x.x)</OBJECTIVE_1>
<OBJECTIVE_2>...</OBJECTIVE_2>
<OBJECTIVE_3>...</OBJECTIVE_3>
<OBJECTIVE_4>...</OBJECTIVE_4>
<OBJECTIVE_5>...</OBJECTIVE_5>
<OBJECTIVE_6>...</OBJECTIVE_6>
</MEASURABLE_OBJECTIVES>
<STANDARDS_LIST>One per line: CODE: full description</STANDARDS_LIST>
<MATERIALS_NEEDED>Bulleted style text.</MATERIALS_NEEDED>
<GET_READY_TO_READ>Include QUICK_WRITE, IMPLEMENTATION_STEPS, TEACHING_TIP.</GET_READY_TO_READ>
<VOCABULARY_MINI_LESSON>
<INTRO_INSTRUCTIONS>...</INTRO_INSTRUCTIONS>
<PARTNER_PRACTICE>...</PARTNER_PRACTICE>
<QUICK_CHECK>...</QUICK_CHECK>
<WORD_1>
<WORD>...</WORD><PAGE>...</PAGE><KID_FRIENDLY_DEFINITION>...</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>...</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>...</EXAMPLE_SENTENCE>
</WORD_1>
... repeat through WORD_10 ...
<DIFF_STRUGGLING_READERS>...</DIFF_STRUGGLING_READERS>
<DIFF_ELL_STUDENTS>...</DIFF_ELL_STUDENTS>
<DIFF_ADVANCED>...</DIFF_ADVANCED>
</VOCABULARY_MINI_LESSON>
<GUIDED_READING>
<SECTION_1><PAGE_RANGE>...</PAGE_RANGE><READ_FROM>...</READ_FROM><READ_TO>...</READ_TO><PAUSE_QUESTIONS>1) [comprehension] ...</PAUSE_QUESTIONS></SECTION_1>
<SECTION_2>...</SECTION_2>
<SECTION_3>...</SECTION_3>
<SECTION_4>...</SECTION_4>
<TEACHING_TIP>...</TEACHING_TIP>
<DIFF_STRUGGLING_READERS>...</DIFF_STRUGGLING_READERS>
<DIFF_ELL_STUDENTS>...</DIFF_ELL_STUDENTS>
<DIFF_ADVANCED>...</DIFF_ADVANCED>
</GUIDED_READING>
<TIERED_DISCUSSION>
<LEVEL_1_LITERAL>4 questions with expected answers + teaching tip</LEVEL_1_LITERAL>
<LEVEL_2_INFERENTIAL>4 questions with expected answers + teaching tip</LEVEL_2_INFERENTIAL>
<LEVEL_3_ANALYTICAL>4 questions with expected answers + teaching tip</LEVEL_3_ANALYTICAL>
<LEVEL_4_PERSONAL>4 questions with expected answers + teaching tip</LEVEL_4_PERSONAL>
<DISCUSSION_MANAGEMENT_NOTES>...</DISCUSSION_MANAGEMENT_NOTES>
</TIERED_DISCUSSION>
<THINK_ABOUT_THE_STORY_ANSWERS>Q/A with citations</THINK_ABOUT_THE_STORY_ANSWERS>
<READING_BETWEEN_THE_LINES_ANSWERS>Q/A with citations</READING_BETWEEN_THE_LINES_ANSWERS>
<DIG_DEEPER_ANSWERS>Q/A with citations</DIG_DEEPER_ANSWERS>
<MULTIPLE_CHOICE_ANSWERS>Correct choice and explanation for each</MULTIPLE_CHOICE_ANSWERS>
<SHORT_ANSWER_ANSWERS>3 model answers with page citations</SHORT_ANSWER_ANSWERS>
<CREATIVE_RESPONSE_GUIDE>5 error types + teacher notes lines</CREATIVE_RESPONSE_GUIDE>
<CHARACTER_CHART_ANSWER_KEY>Heidi, Deta, Alm-Uncle, Peter, Barbara with evidence and page citations</CHARACTER_CHART_ANSWER_KEY>
<TIMELINE_ANSWER_KEY>Events 1-7 in order</TIMELINE_ANSWER_KEY>
<EXIT_TICKET_GUIDE>success criteria + strong/developing/needs support samples + collection note</EXIT_TICKET_GUIDE>
<DIFFERENTIATION_SUMMARY>Struggling readers / ELL / advanced students sections as specified</DIFFERENTIATION_SUMMARY>
</TEACHER_GUIDE>
"""


def _chapter_text(chapter_json: Dict[str, Any]) -> str:
    pages = chapter_json.get("pages") or []
    if pages:
        chunks = []
        for p in pages:
            text = (p.get("text") or "").strip()
            if text:
                chunks.append(f"[PAGE {p['page_number']}]\\n{text}")
        return "\\n\\n".join(chunks)
    return (chapter_json.get("full_text") or "").strip()


def build_system_prompt(chapter_json: Dict[str, Any], grade: int) -> str:
    guidance = GRADE_GUIDANCE.get(grade, GRADE_GUIDANCE[5])
    return f"""You are generating a CB4A Teacher Guide for grade {grade}.

CRITICAL RULES:
1) Use ONLY the supplied chapter JSON text below. Never use web knowledge or prior knowledge.
2) Every answer key claim must be anchored to the chapter text and include exact page citations from the JSON.
3) Guided reading page ranges must use actual page numbers from the JSON.
4) Keep all language and cognitive complexity grade-appropriate: {guidance}
5) The teacher guide must mirror the student workbook sections with teacher-facing answers, teaching tips, and differentiation.
6) Return all 18 slots in the exact sequence required.

BOOK META:
Title: {chapter_json.get('book_title', 'Unknown')}
Author: {chapter_json.get('author', 'Unknown')}
Chapter: {chapter_json.get('chapter_num', '')} — {chapter_json.get('chapter_title', '')}
Grade: {grade}

CHAPTER TEXT (only source of truth):
{_chapter_text(chapter_json)}
"""


def build_user_prompt(chapter_json: Dict[str, Any], grade: int) -> str:
    return f"""Generate a complete Teacher Guide for grade {grade} from this chapter only.

Must include every slot in this exact order:
1 LESSON_OVERVIEW
2 MEASURABLE_OBJECTIVES
3 STANDARDS_LIST
4 MATERIALS_NEEDED
5 GET_READY_TO_READ
6 VOCABULARY_MINI_LESSON
7 GUIDED_READING
8 TIERED_DISCUSSION
9 THINK_ABOUT_THE_STORY_ANSWERS
10 READING_BETWEEN_THE_LINES_ANSWERS
11 DIG_DEEPER_ANSWERS
12 MULTIPLE_CHOICE_ANSWERS
13 SHORT_ANSWER_ANSWERS
14 CREATIVE_RESPONSE_GUIDE
15 CHARACTER_CHART_ANSWER_KEY
16 TIMELINE_ANSWER_KEY
17 EXIT_TICKET_GUIDE
18 DIFFERENTIATION_SUMMARY

Formatting constraints:
- Include citations as (p. N) where required.
- Vocabulary must include exactly 10 words.
- Guided reading must include exactly 4 sections.
- Discussion must include 4 levels with 4 questions each and expected answers.

{_OUTPUT_FORMAT}
"""
