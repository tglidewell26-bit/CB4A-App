"""Derive workbook and teacher-guide sections from canonical LessonData."""

from __future__ import annotations

from typing import Dict, List, Tuple

from curriculum_pipeline.models import LessonData, RenderedTeacherGuide, RenderedWorkbook


def derive_sections(lesson: LessonData) -> Tuple[RenderedWorkbook, RenderedTeacherGuide]:
    """Derive both products deterministically from the same LessonData object."""
    workbook_sections: Dict[str, object] = {
        "before_you_read": {"focus_question": lesson.before_you_read_question},
        "vocabulary": [v.model_dump() for v in lesson.vocabulary if not v.teacher_only],
        "comprehension_questions": [q.model_dump() for q in lesson.comprehension_questions],
        "inference_questions": [q.model_dump() for q in lesson.inference_questions],
        "analysis_questions": [q.model_dump() for q in lesson.analysis_questions],
        "multiple_choice": [q.model_dump() for q in lesson.multiple_choice],
        "short_answer": [q.model_dump() for q in lesson.short_answer],
        "creative_response": lesson.creative_response.model_dump(),
        "timeline": [e.model_dump() for e in sorted(lesson.timeline, key=lambda e: e.order_index)],
        "prediction": lesson.prediction.model_dump(),
    }

    teacher_sections: Dict[str, object] = {
        "before_you_read": {"launch_guidance": lesson.before_you_read_teacher_guidance},
        "vocabulary": [v.model_dump() for v in lesson.vocabulary if v.id in lesson.teacher_vocabulary_ids],
        "comprehension_questions": [s.model_dump() for s in lesson.teacher_support_by_section.get("comprehension_questions", [])],
        "inference_questions": [s.model_dump() for s in lesson.teacher_support_by_section.get("inference_questions", [])],
        "analysis_questions": [s.model_dump() for s in lesson.teacher_support_by_section.get("analysis_questions", [])],
        "multiple_choice": [s.model_dump() for s in lesson.teacher_support_by_section.get("multiple_choice", [])],
        "short_answer": [s.model_dump() for s in lesson.teacher_support_by_section.get("short_answer", [])],
        "creative_response": [s.model_dump() for s in lesson.teacher_support_by_section.get("creative_response", [])],
        "timeline": [s.model_dump() for s in lesson.teacher_support_by_section.get("timeline", [])],
        "prediction": [s.model_dump() for s in lesson.teacher_support_by_section.get("prediction", [])],
    }

    workbook_ids = _collect_workbook_ids(lesson)
    teacher_ids = _collect_teacher_ids(lesson)

    workbook = RenderedWorkbook(sections=workbook_sections, source_item_ids=sorted(workbook_ids))
    teacher = RenderedTeacherGuide(sections=teacher_sections, source_item_ids=sorted(teacher_ids))
    return workbook, teacher


def _collect_workbook_ids(lesson: LessonData) -> set[str]:
    ids: set[str] = {v.id for v in lesson.vocabulary if not v.teacher_only}
    ids.update(q.id for q in lesson.comprehension_questions)
    ids.update(q.id for q in lesson.inference_questions)
    ids.update(q.id for q in lesson.analysis_questions)
    ids.update(q.id for q in lesson.multiple_choice)
    ids.update(q.id for q in lesson.short_answer)
    ids.add(lesson.creative_response.id)
    ids.update(e.id for e in lesson.timeline)
    ids.add(lesson.prediction.id)
    return ids


def _collect_teacher_ids(lesson: LessonData) -> set[str]:
    ids: set[str] = set(lesson.teacher_vocabulary_ids)
    for supports in lesson.teacher_support_by_section.values():
        ids.update(s.item_id for s in supports)
    return ids
