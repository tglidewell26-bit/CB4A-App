"""High-level deterministic pipeline orchestration."""

from __future__ import annotations

from typing import Any, Dict, Tuple

from curriculum_pipeline.derivation import derive_sections
from curriculum_pipeline.models import AlignmentReport, RenderedTeacherGuide, RenderedWorkbook
from curriculum_pipeline.normalization import normalize_to_lesson_data
from curriculum_pipeline.renderer import render_teacher_markdown, render_workbook_markdown
from curriculum_pipeline.validation import validate_alignment


def generate_aligned_outputs(extracted_json: Dict[str, Any]) -> Tuple[RenderedWorkbook, RenderedTeacherGuide, AlignmentReport]:
    """Run normalization -> derivation -> validation -> rendering.

    Validation runs before markdown assignment. Rendering remains deterministic.
    """
    lesson = normalize_to_lesson_data(extracted_json)
    workbook, teacher = derive_sections(lesson)
    report = validate_alignment(lesson, workbook, teacher)
    workbook.markdown = render_workbook_markdown(workbook)
    teacher.markdown = render_teacher_markdown(teacher)
    return workbook, teacher, report
