import pytest

from app.models.lesson_schema import MultipleChoiceQuestion, VocabularyItem


def test_vocab_id_prefix_validation():
    with pytest.raises(ValueError):
        VocabularyItem(id="bad_001", term="x", definition="y")


def test_mcq_correct_option_validation():
    with pytest.raises(ValueError):
        MultipleChoiceQuestion(id="mcq_001", prompt="p", options=["a", "b"], correct_option=2)
