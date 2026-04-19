import json
from pathlib import Path

import pytest

from app.models.lesson_schema import LessonData
from app.services.alignment_validator import AlignmentError, validate_alignment
from app.services.derive_teacher_guide import derive_teacher_guide
from app.services.derive_workbook import derive_workbook


def _lesson() -> LessonData:
    payload = json.loads(Path("app/fixtures/sample_lesson_data.json").read_text(encoding="utf-8"))
    return LessonData.model_validate(payload)


def test_alignment_passes_for_fixture():
    lesson = _lesson()
    report = validate_alignment(lesson, derive_workbook(lesson), derive_teacher_guide(lesson))
    assert report.passed is True
    assert report.coverage_by_section["multiple_choice"] == 1.0


def test_alignment_fails_for_wrong_mcq_answer():
    lesson = _lesson()
    lesson.teacher_support_by_section["multiple_choice"][0].correct_option = 0
    with pytest.raises(AlignmentError):
        validate_alignment(lesson, derive_workbook(lesson), derive_teacher_guide(lesson))


def test_alignment_fails_for_unknown_teacher_reference():
    lesson = _lesson()
    lesson.teacher_support_by_section["short_answer"][0].item_id = "short_999"
    with pytest.raises(AlignmentError):
        validate_alignment(lesson, derive_workbook(lesson), derive_teacher_guide(lesson))
