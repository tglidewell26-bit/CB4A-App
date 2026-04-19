"""Deterministic chapter-text extraction into structured JSON.

This stage intentionally returns JSON only. It does not return markdown and does
not generate teacher/workbook artifacts directly.
"""

from __future__ import annotations

from typing import Any, Dict, List


def extract_structured_json(chapter_text: str) -> Dict[str, Any]:
    """Extract deterministic structured data from chapter text.

    The output is a machine-readable draft. Downstream normalization enforces
    required fields and completeness.
    """
    if not chapter_text or not chapter_text.strip():
        raise ValueError("chapter_text is required for source extraction.")

    paragraphs = [p.strip() for p in chapter_text.split("\n\n") if p.strip()]
    first_sentence = paragraphs[0].split(".")[0].strip() + "." if paragraphs else ""

    return {
        "lesson_title": "Chapter Lesson",
        "before_you_read_question": f"What stands out most in this chapter opening: {first_sentence}",
        "before_you_read_teacher_guidance": "Prompt students to cite one detail from the opening paragraphs.",
        "vocabulary": [],
        "comprehension_questions": [],
        "inference_questions": [],
        "analysis_questions": [],
        "multiple_choice": [],
        "short_answer": [],
        "creative_response": {
            "id": "creative_001",
            "prompt": "Write a short response connecting a character choice to a chapter event.",
            "hints": ["Name the choice.", "Cite one event from the text."],
            "rubric_criteria": ["Uses textual evidence", "Explains character choice"],
            "focus_keywords": ["character", "event", "evidence"],
        },
        "timeline": [],
        "prediction": {"id": "pred_001", "prompt": "Predict what may happen next and explain why."},
        "teacher_support_by_section": {
            "comprehension_questions": [],
            "inference_questions": [],
            "analysis_questions": [],
            "multiple_choice": [],
            "short_answer": [],
            "creative_response": [],
            "timeline": [],
            "prediction": [],
        },
        "teacher_vocabulary_ids": [],
    }
