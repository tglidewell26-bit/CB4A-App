"""
Parser for the XML-tagged workbook response produced by Claude.

Uses regex rather than a strict XML parser so minor formatting variations
(extra whitespace, mixed case, missing closing tags at end of stream) don't
cause hard failures.  Every field falls back to an empty string or empty list
rather than raising, so the doc builder always receives a complete structure.
"""

import re
from typing import Any, Dict, List, Optional


# ── Primitive extractors ──────────────────────────────────────────────────────

def _tag(text: str, tag: str) -> str:
    """Return the (stripped) content between the first matching pair of tags."""
    pattern = rf"<{re.escape(tag)}>(.*?)</{re.escape(tag)}>"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _tag_block(text: str, tag: str) -> str:
    """Return the raw inner text of a container tag (e.g. <VOCABULARY>...</VOCABULARY>)."""
    return _tag(text, tag)


def _numbered_items(
    container_text: str,
    prefix: str,
    count: int,
    fields: List[str],
) -> List[Dict[str, str]]:
    """
    Extract numbered sub-items from a container block.

    Args:
        container_text: The inner text of the parent tag.
        prefix:         Tag prefix, e.g. "VOCAB" → looks for VOCAB_1 … VOCAB_n.
        count:          How many items to attempt to extract.
        fields:         Sub-field tag names to extract from each item.

    Returns:
        List of dicts, one per item found (missing items are included as empty dicts).
    """
    items = []
    for i in range(1, count + 1):
        item_text = _tag(container_text, f"{prefix}_{i}")
        item: Dict[str, str] = {f: _tag(item_text, f) for f in fields}
        items.append(item)
    return items


# ── Section parsers ───────────────────────────────────────────────────────────

def _parse_vocabulary(workbook: str) -> List[Dict[str, str]]:
    vocab_block = _tag_block(workbook, "VOCABULARY")
    return _numbered_items(
        vocab_block,
        prefix="VOCAB",
        count=10,
        fields=["WORD", "BOOK_QUOTE", "DEFINITION", "EXAMPLE_SENTENCE"],
    )


def _parse_question_set(
    workbook: str,
    container_tag: str,
    prefix: str,
    count: int,
) -> List[Dict[str, str]]:
    block = _tag_block(workbook, container_tag)
    return _numbered_items(block, prefix=prefix, count=count, fields=["QUESTION", "ANSWER"])


def _parse_multiple_choice(workbook: str) -> List[Dict[str, str]]:
    block = _tag_block(workbook, "MULTIPLE_CHOICE")
    return _numbered_items(
        block,
        prefix="MC",
        count=3,
        fields=["QUESTION", "OPTION_A", "OPTION_B", "OPTION_C", "OPTION_D", "CORRECT_ANSWER"],
    )


def _parse_creative_response(workbook: str) -> Dict[str, str]:
    block = _tag_block(workbook, "CREATIVE_RESPONSE")
    return {
        "PROMPT": _tag(block, "PROMPT"),
        "HINT_1": _tag(block, "HINT_1"),
        "HINT_2": _tag(block, "HINT_2"),
        "HINT_3": _tag(block, "HINT_3"),
    }


def _parse_timeline(workbook: str) -> List[str]:
    block = _tag_block(workbook, "TIMELINE_EVENTS")
    events = []
    for i in range(1, 8):
        ev = _tag(block, f"EVENT_{i}")
        events.append(ev)
    return events


# ── Main entry point ──────────────────────────────────────────────────────────

def parse_workbook_response(raw_response: str) -> Dict[str, Any]:
    """
    Parse Claude's raw text response into a structured dict.

    The dict mirrors the 10 workbook sections:
        {
            "focus_question": str,
            "vocabulary": [{"WORD": ..., "BOOK_QUOTE": ..., ...}, ...],   # 10 items
            "basic_comprehension": [{"QUESTION": ..., "ANSWER": ...}, ...], # 6
            "inference_questions": [...],                                    # 3
            "analysis_questions":  [...],                                    # 3
            "multiple_choice":     [...],                                    # 3
            "short_answer":        [...],                                    # 3
            "creative_response":   {"PROMPT": ..., "HINT_1": ..., ...},
            "timeline_events":     [str, ...],                               # 7
            "prediction_setup":    str,
        }

    If a section is missing or malformed, its value is an empty string / list
    so the doc builder can still render something for every slot.
    """
    # Isolate the WORKBOOK block; fall back to the whole response if absent.
    workbook = _tag(raw_response, "WORKBOOK")
    if not workbook:
        workbook = raw_response  # let child parsers do their best

    return {
        "focus_question": _tag(workbook, "FOCUS_QUESTION"),
        "vocabulary": _parse_vocabulary(workbook),
        "basic_comprehension": _parse_question_set(
            workbook, "BASIC_COMPREHENSION", "BC", 6
        ),
        "inference_questions": _parse_question_set(
            workbook, "INFERENCE_QUESTIONS", "IQ", 3
        ),
        "analysis_questions": _parse_question_set(
            workbook, "ANALYSIS_QUESTIONS", "AQ", 3
        ),
        "multiple_choice": _parse_multiple_choice(workbook),
        "short_answer": _parse_question_set(workbook, "SHORT_ANSWER", "SA", 3),
        "creative_response": _parse_creative_response(workbook),
        "timeline_events": _parse_timeline(workbook),
        "prediction_setup": _tag(workbook, "PREDICTION_SETUP"),
    }
