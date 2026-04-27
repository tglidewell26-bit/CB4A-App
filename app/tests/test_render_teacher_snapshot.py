import json
from pathlib import Path

from app.models.lesson_schema import LessonData
from app.renderers.teacher_markdown import render_teacher_markdown
from app.services.derive_teacher_guide import derive_teacher_guide


def test_teacher_markdown_snapshot():
    lesson = LessonData.model_validate(json.loads(Path("app/fixtures/sample_lesson_data.json").read_text(encoding="utf-8")))
    markdown = render_teacher_markdown(derive_teacher_guide(lesson))
    expected = Path("app/fixtures/expected_teacher.md").read_text(encoding="utf-8")
    assert markdown == expected
