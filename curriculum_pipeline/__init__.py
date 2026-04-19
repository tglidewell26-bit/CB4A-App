"""Alignment-enforced curriculum generation pipeline."""

from curriculum_pipeline.derivation import derive_sections
from curriculum_pipeline.extraction import extract_structured_json
from curriculum_pipeline.models import AlignmentReport, LessonData, RenderedTeacherGuide, RenderedWorkbook
from curriculum_pipeline.normalization import normalize_to_lesson_data
from curriculum_pipeline.renderer import render_teacher_markdown, render_workbook_markdown
from curriculum_pipeline.validation import validate_alignment


__all__ = [
    "AlignmentReport",
    "LessonData",
    "RenderedTeacherGuide",
    "RenderedWorkbook",
    "extract_structured_json",
    "normalize_to_lesson_data",
    "derive_sections",
    "validate_alignment",
    "render_workbook_markdown",
    "render_teacher_markdown",
]
