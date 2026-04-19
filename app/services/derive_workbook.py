"""Derive student workbook structure from canonical LessonData."""

from __future__ import annotations

from app.models.lesson_schema import LessonData, RenderedWorkbook


def derive_workbook(lesson: LessonData) -> RenderedWorkbook:
    sections = {
        "before_you_read": {"focus_question": lesson.before_you_read_question},
        "vocabulary": [v.model_dump() for v in lesson.vocabulary if not v.teacher_only],
        "comprehension_questions": [q.model_dump() for q in lesson.comprehension_questions],
        "inference_questions": [q.model_dump() for q in lesson.inference_questions],
        "analysis_questions": [q.model_dump() for q in lesson.analysis_questions],
        "multiple_choice": [q.model_dump() for q in lesson.multiple_choice],
        "short_answer": [q.model_dump() for q in lesson.short_answer],
        "creative_response": lesson.creative_response.model_dump(),
        "timeline": [e.model_dump() for e in sorted(lesson.timeline, key=lambda t: t.order_index)],
        "prediction": lesson.prediction.model_dump(),
    }
    return RenderedWorkbook(sections=sections)
