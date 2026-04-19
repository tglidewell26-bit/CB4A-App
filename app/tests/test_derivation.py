import json
from pathlib import Path

from app.services.derive_teacher_guide import derive_teacher_guide
from app.services.derive_workbook import derive_workbook

from app.models.lesson_schema import LessonData


def _lesson() -> LessonData:
    payload = json.loads(Path("app/fixtures/sample_lesson_data.json").read_text(encoding="utf-8"))
    return LessonData.model_validate(payload)


def test_derivation_uses_same_vocab_ids():
    lesson = _lesson()
    workbook = derive_workbook(lesson)
    teacher = derive_teacher_guide(lesson)
    assert {v['id'] for v in workbook.sections['vocabulary']} == {v['id'] for v in teacher.sections['vocabulary']}


def test_derivation_never_invents_sections():
    lesson = _lesson()
    workbook = derive_workbook(lesson)
    teacher = derive_teacher_guide(lesson)
    assert set(workbook.sections.keys()) == set(teacher.sections.keys())
