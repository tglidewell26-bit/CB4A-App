import json
from pathlib import Path

from app.services.normalize_lesson import normalize_lesson


def test_normalize_assigns_deterministic_ids():
    raw = json.loads(Path("app/fixtures/sample_extraction.json").read_text(encoding="utf-8"))
    lesson = normalize_lesson(raw)
    assert lesson.vocabulary[0].id == "vocab_001"
    assert lesson.comprehension_questions[0].id == "comp_001"
    assert lesson.multiple_choice[0].id == "mcq_001"
