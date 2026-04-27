"""Alignment validation between workbook and teacher outputs."""

from __future__ import annotations

from typing import Dict, List, Set

try:
    from deepdiff import DeepDiff
except Exception:  # pragma: no cover - environment fallback
    DeepDiff = None

from app.models.lesson_schema import AlignmentReport, LessonData, RenderedTeacherGuide, RenderedWorkbook


class AlignmentError(Exception):
    """Hard failure when workbook/teacher alignment invariants are violated."""


REQUIRED_SECTIONS = [
    "comprehension_questions",
    "inference_questions",
    "analysis_questions",
    "multiple_choice",
    "short_answer",
    "creative_response",
    "timeline",
    "prediction",
]


def validate_alignment(
    lesson: LessonData,
    workbook: RenderedWorkbook,
    teacher: RenderedTeacherGuide,
    allow_teacher_only_vocabulary: bool = False,
) -> AlignmentReport:
    errors: List[str] = []
    coverage: Dict[str, float] = {}

    workbook_vocab = {v["term"] for v in workbook.sections["vocabulary"]}
    teacher_vocab = {v["term"] for v in teacher.sections["vocabulary"] if not v.get("teacher_only")}
    if workbook_vocab != teacher_vocab and not allow_teacher_only_vocabulary:
        errors.append("vocab_terms_workbook == vocab_terms_teacher failed")

    workbook_ids = _workbook_ids(lesson)
    teacher_ids = _teacher_ids(teacher)

    for section in REQUIRED_SECTIONS:
        wb = workbook_ids[section]
        tg = teacher_ids[section]
        coverage[section] = (len(wb & tg) / len(wb)) if wb else 1.0
        if wb != tg:
            if DeepDiff is not None:
                diff = DeepDiff(sorted(wb), sorted(tg), ignore_order=True)
                errors.append(f"{section} ID mismatch: {diff}")
            else:
                errors.append(f"{section} ID mismatch: workbook={sorted(wb)} teacher={sorted(tg)}")

    unknown_teacher_ids = sorted(set().union(*teacher_ids.values()) - set().union(*workbook_ids.values()))
    if unknown_teacher_ids:
        errors.append(f"Teacher references unknown workbook IDs: {unknown_teacher_ids}")

    mcq_lookup = {q.id: q for q in lesson.multiple_choice}
    for support in teacher.sections["multiple_choice"]:
        qid = support["item_id"]
        if qid in mcq_lookup and support.get("correct_option") != mcq_lookup[qid].correct_option:
            errors.append(f"MCQ rationale references wrong correct option for {qid}")

    canonical_order = [e.id for e in sorted(lesson.timeline, key=lambda e: e.order_index)]
    for support in teacher.sections["timeline"]:
        if support.get("ordered_event_ids") != canonical_order:
            errors.append("timeline.teacher_correct_order must be derived from LessonData.timeline_events")
            break

    creative_support = teacher.sections["creative_response"][0] if teacher.sections["creative_response"] else {}
    if creative_support.get("prompt_id") != lesson.creative_response.id:
        errors.append("creative_response.rubric.prompt_id == creative_response.prompt.id failed")

    rubric = " ".join(creative_support.get("rubric") or []).lower()
    for keyword in lesson.creative_response.focus_keywords:
        if keyword.lower() not in rubric:
            errors.append(f"Creative rubric missing focus keyword '{keyword}'")

    report = AlignmentReport(passed=not errors, errors=errors, coverage_by_section=coverage)
    if errors:
        raise AlignmentError(_format_report(report))
    return report


def _workbook_ids(lesson: LessonData) -> Dict[str, Set[str]]:
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


def _teacher_ids(teacher: RenderedTeacherGuide) -> Dict[str, Set[str]]:
    result: Dict[str, Set[str]] = {}
    for section in REQUIRED_SECTIONS:
        result[section] = {item["item_id"] for item in teacher.sections[section]}
    return result


def _format_report(report: AlignmentReport) -> str:
    return (
        f"Alignment failed with {len(report.errors)} error(s). "
        f"Coverage: {report.coverage_by_section}. "
        f"Errors: {report.errors}"
    )
