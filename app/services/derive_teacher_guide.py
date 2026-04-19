"""Derive teacher-guide structure from canonical LessonData."""

from __future__ import annotations

from app.models.lesson_schema import LessonData, RenderedTeacherGuide


def derive_teacher_guide(lesson: LessonData) -> RenderedTeacherGuide:
    sections = {
        "before_you_read": {"launch_guidance": lesson.before_you_read_teacher_guidance},
        "vocabulary": [v.model_dump() for v in lesson.vocabulary if v.id in lesson.teacher_vocabulary_ids],
        "comprehension_questions": [s.model_dump() for s in lesson.teacher_support_by_section["comprehension_questions"]],
        "inference_questions": [s.model_dump() for s in lesson.teacher_support_by_section["inference_questions"]],
        "analysis_questions": [s.model_dump() for s in lesson.teacher_support_by_section["analysis_questions"]],
        "multiple_choice": [s.model_dump() for s in lesson.teacher_support_by_section["multiple_choice"]],
        "short_answer": [s.model_dump() for s in lesson.teacher_support_by_section["short_answer"]],
        "creative_response": [s.model_dump() for s in lesson.teacher_support_by_section["creative_response"]],
        "timeline": [s.model_dump() for s in lesson.teacher_support_by_section["timeline"]],
        "prediction": [s.model_dump() for s in lesson.teacher_support_by_section["prediction"]],
    }
    return RenderedTeacherGuide(sections=sections)
