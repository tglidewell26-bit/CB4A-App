import re
from typing import Any, Dict, List


def _tag(text: str, tag: str) -> str:
    m = re.search(rf"<{re.escape(tag)}>(.*?)</{re.escape(tag)}>", text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _parse_vocab(vocab_block: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for i in range(1, 11):
        block = _tag(vocab_block, f"WORD_{i}")
        rows.append(
            {
                "WORD": _tag(block, "WORD"),
                "PAGE": _tag(block, "PAGE"),
                "KID_FRIENDLY_DEFINITION": _tag(block, "KID_FRIENDLY_DEFINITION"),
                "CONTEXT_SENTENCE": _tag(block, "CONTEXT_SENTENCE"),
                "EXAMPLE_SENTENCE": _tag(block, "EXAMPLE_SENTENCE"),
            }
        )
    return rows


def _parse_guided_sections(guided_block: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for i in range(1, 5):
        block = _tag(guided_block, f"SECTION_{i}")
        rows.append(
            {
                "SECTION_NUMBER": str(i),
                "PAGE_RANGE": _tag(block, "PAGE_RANGE"),
                "READ_FROM": _tag(block, "READ_FROM"),
                "READ_TO": _tag(block, "READ_TO"),
                "PAUSE_QUESTIONS": _tag(block, "PAUSE_QUESTIONS"),
            }
        )
    return rows


def parse_teacher_response(raw_response: str) -> Dict[str, Any]:
    root = _tag(raw_response, "TEACHER_GUIDE") or raw_response
    vocab_block = _tag(root, "VOCABULARY_MINI_LESSON")
    guided_block = _tag(root, "GUIDED_READING")
    tiered_block = _tag(root, "TIERED_DISCUSSION")

    return {
        "lesson_overview": _tag(root, "LESSON_OVERVIEW"),
        "measurable_objectives": _tag(root, "MEASURABLE_OBJECTIVES"),
        "standards_list": _tag(root, "STANDARDS_LIST"),
        "materials_needed": _tag(root, "MATERIALS_NEEDED"),
        "get_ready_to_read": _tag(root, "GET_READY_TO_READ"),
        "vocabulary": _parse_vocab(vocab_block),
        "vocab_intro": _tag(vocab_block, "INTRO_INSTRUCTIONS"),
        "vocab_partner_practice": _tag(vocab_block, "PARTNER_PRACTICE"),
        "vocab_quick_check": _tag(vocab_block, "QUICK_CHECK"),
        "vocab_diff_struggling": _tag(vocab_block, "DIFF_STRUGGLING_READERS"),
        "vocab_diff_ell": _tag(vocab_block, "DIFF_ELL_STUDENTS"),
        "vocab_diff_advanced": _tag(vocab_block, "DIFF_ADVANCED"),
        "guided_sections": _parse_guided_sections(guided_block),
        "guided_tip": _tag(guided_block, "TEACHING_TIP"),
        "guided_diff_struggling": _tag(guided_block, "DIFF_STRUGGLING_READERS"),
        "guided_diff_ell": _tag(guided_block, "DIFF_ELL_STUDENTS"),
        "guided_diff_advanced": _tag(guided_block, "DIFF_ADVANCED"),
        "tiered_level_1": _tag(tiered_block, "LEVEL_1_LITERAL"),
        "tiered_level_2": _tag(tiered_block, "LEVEL_2_INFERENTIAL"),
        "tiered_level_3": _tag(tiered_block, "LEVEL_3_ANALYTICAL"),
        "tiered_level_4": _tag(tiered_block, "LEVEL_4_PERSONAL"),
        "tiered_management": _tag(tiered_block, "DISCUSSION_MANAGEMENT_NOTES"),
        "think_about_answers": _tag(root, "THINK_ABOUT_THE_STORY_ANSWERS"),
        "reading_between_answers": _tag(root, "READING_BETWEEN_THE_LINES_ANSWERS"),
        "dig_deeper_answers": _tag(root, "DIG_DEEPER_ANSWERS"),
        "multiple_choice_answers": _tag(root, "MULTIPLE_CHOICE_ANSWERS"),
        "short_answer_answers": _tag(root, "SHORT_ANSWER_ANSWERS"),
        "creative_response_guide": _tag(root, "CREATIVE_RESPONSE_GUIDE"),
        "character_chart_answer_key": _tag(root, "CHARACTER_CHART_ANSWER_KEY"),
        "timeline_answer_key": _tag(root, "TIMELINE_ANSWER_KEY"),
        "exit_ticket_guide": _tag(root, "EXIT_TICKET_GUIDE"),
        "differentiation_summary": _tag(root, "DIFFERENTIATION_SUMMARY"),
    }
