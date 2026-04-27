"""Alignment validation for workbook/teacher derived outputs."""

from __future__ import annotations

from typing import Dict, Iterable, List, Set

from curriculum_pipeline.models import AlignmentReport, LessonData, RenderedTeacherGuide, RenderedWorkbook


REQUIRED_MAPPED_SECTIONS = (
    "comprehension_questions",
    "inference_questions",
    "analysis_questions",
    "multiple_choice",
    "short_answer",
    "creative_response",
    "timeline",
    "prediction",
)


class AlignmentError(ValueError):
    """Raised when alignment validation fails."""


def validate_alignment(
    lesson: LessonData,
    workbook: RenderedWorkbook,
    teacher: RenderedTeacherGuide,
    allow_teacher_only_vocab: bool = False,
) -> AlignmentReport:
    errors: List[str] = []

    workbook_vocab_terms = {item["term"] for item in workbook.sections.get("vocabulary", [])}
    teacher_vocab_terms = {item["term"] for item in teacher.sections.get("vocabulary", []) if not item.get("teacher_only")}
    if workbook_vocab_terms != teacher_vocab_terms and not allow_teacher_only_vocab:
        errors.append("Vocabulary term sets must match exactly between workbook and teacher guide.")

    workbook_ids_by_section = _workbook_ids_by_section(lesson)
    teacher_ids_by_section = _teacher_ids_by_section(teacher)

    for section in REQUIRED_MAPPED_SECTIONS:
        wb_ids = workbook_ids_by_section[section]
        tg_ids = teacher_ids_by_section.get(section, set())
        if len(wb_ids) != len(tg_ids):
            errors.append(f"Section '{section}' mapped ID counts do not match ({len(wb_ids)} != {len(tg_ids)}).")
        if wb_ids != tg_ids:
            errors.append(f"Section '{section}' has orphan or unknown IDs.")

    # No unknown teacher references
    all_workbook_ids = set().union(*workbook_ids_by_section.values())
    all_workbook_ids.update(v.id for v in lesson.vocabulary if not v.teacher_only)
    all_teacher_ids = set().union(*teacher_ids_by_section.values()) if teacher_ids_by_section else set()
    unknown = sorted(all_teacher_ids - all_workbook_ids)
    if unknown:
        errors.append(f"Teacher support references unknown workbook IDs: {unknown}")

    # MCQ correctness check (rationale aligned to correct option)
    mcq_lookup = {q.id: q for q in lesson.multiple_choice}
    for item in teacher.sections.get("multiple_choice", []):
        qid = item["item_id"]
        if qid in mcq_lookup and item.get("correct_option") != mcq_lookup[qid].correct_option:
            errors.append(f"MCQ rationale/correct option mismatch for {qid}.")

    # Timeline order check
    canonical_timeline = [e.id for e in sorted(lesson.timeline, key=lambda e: e.order_index)]
    for item in teacher.sections.get("timeline", []):
        if item.get("ordered_event_ids") != canonical_timeline:
            errors.append("Timeline support order does not match canonical timeline order.")

    # Creative prompt/rubric rule: each focus keyword must appear in at least one rubric criterion.
    rubric_items = teacher.sections.get("creative_response", [])
    rubric_list = rubric_items[0].get("rubric", []) if rubric_items else []
    lower_rubric = " ".join(rubric_list).lower()
    for keyword in lesson.creative_response.focus_keywords:
        if keyword.lower() not in lower_rubric:
            errors.append(f"Creative rubric does not align to prompt focus keyword: '{keyword}'.")

    if not set(workbook.source_item_ids).issubset(all_workbook_ids):
        errors.append("Workbook rendered sections contain non-canonical source IDs.")
    canonical_ids = {v.id for v in lesson.vocabulary}
    canonical_ids.update(all_workbook_ids)
    if not set(teacher.source_item_ids).issubset(canonical_ids):
        errors.append("Teacher rendered sections contain non-canonical source IDs.")

    report = AlignmentReport(passed=not errors, errors=errors)
    if not report.passed:
        raise AlignmentError("Alignment validation failed: " + " | ".join(errors))
    return report


def _workbook_ids_by_section(lesson: LessonData) -> Dict[str, Set[str]]:
    return {
        "comprehension_questions": {q.id for q in lesson.comprehension_questions},
        "inference_questions": {q.id for q in lesson.inference_questions},
        "analysis_questions": {q.id for q in lesson.analysis_questions},
        "multiple_choice": {q.id for q in lesson.multiple_choice},
        "short_answer": {q.id for q in lesson.short_answer},
        "creative_response": {lesson.creative_response.id},
        "timeline": {e.id for e in lesson.timeline},
        "prediction": {lesson.prediction.id},
    }


def _teacher_ids_by_section(teacher: RenderedTeacherGuide) -> Dict[str, Set[str]]:
    out: Dict[str, Set[str]] = {}
    for section in REQUIRED_MAPPED_SECTIONS:
        items = teacher.sections.get(section, [])
        out[section] = {item["item_id"] for item in items}
    return out
