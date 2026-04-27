"""Normalization stage for canonical LessonData."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List

from curriculum_pipeline.models import LessonData


class NormalizationError(ValueError):
    """Raised when extracted source data is malformed or incomplete."""


def normalize_to_lesson_data(extracted: Dict[str, Any]) -> LessonData:
    """Normalize extracted source JSON into canonical LessonData.

    - deduplicates list entries by id
    - validates required fields
    - fails loudly on malformed input
    """
    if not isinstance(extracted, dict):
        raise NormalizationError("Extracted payload must be a dictionary.")

    cleaned = dict(extracted)
    for key in (
        "vocabulary",
        "comprehension_questions",
        "inference_questions",
        "analysis_questions",
        "multiple_choice",
        "short_answer",
        "timeline",
    ):
        cleaned[key] = _dedupe_by_id(extracted.get(key, []), key)

    _assert_non_empty(cleaned, ["lesson_title", "before_you_read_question", "before_you_read_teacher_guidance"])

    try:
        lesson = LessonData.model_validate(cleaned)
    except Exception as exc:  # pydantic gives structured error text
        raise NormalizationError(f"Normalization failed: {exc}") from exc

    return lesson


def _dedupe_by_id(items: Iterable[Dict[str, Any]], section_name: str) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    result: List[Dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            raise NormalizationError(f"{section_name} entries must be objects.")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            raise NormalizationError(f"{section_name} contains an entry without a valid 'id'.")
        if item_id in seen:
            continue
        seen.add(item_id)
        result.append(item)
    return result


def _assert_non_empty(payload: Dict[str, Any], required_fields: List[str]) -> None:
    missing = [field for field in required_fields if not isinstance(payload.get(field), str) or not payload[field].strip()]
    if missing:
        raise NormalizationError(f"Missing required non-empty fields: {', '.join(missing)}")
