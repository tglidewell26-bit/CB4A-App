import json
from pathlib import Path

from app.models.lesson_schema import LessonData
from app.renderers.workbook_markdown import render_workbook_markdown
from app.services.derive_workbook import derive_workbook


def test_workbook_markdown_snapshot():
    lesson = LessonData.model_validate(json.loads(Path("app/fixtures/sample_lesson_data.json").read_text(encoding="utf-8")))
    markdown = render_workbook_markdown(derive_workbook(lesson))
    expected = Path("app/fixtures/expected_workbook.md").read_text(encoding="utf-8")
    assert markdown == expected
