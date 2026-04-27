from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from workbook_generator.vocab_selector import select_vocab_words
from workbook_generator.vocab_enricher import enrich_selected_vocab_words


def test_select_vocab_words_scans_grade_list_and_stops_at_10():
    extracted_text = """
[PAGE 1]
Ability and absorb appear early. We also accuse and act.

---PAGE---

[PAGE 2]
Students stay active and learn actual facts, then adopt better habits.
Advice and ambition are included too.

---PAGE---

[PAGE 3]
This page has ancient ideas and approach.
""".strip()

    words = select_vocab_words(extracted_text, 3)

    assert len(words) == 10
    assert words == [
        "ability",
        "absorb",
        "accuse",
        "act",
        "active",
        "actual",
        "adopt",
        "advice",
        "ambition",
        "ancient",
    ]


def test_enrich_selected_vocab_words_captures_sentence_and_page_number():
    extracted_text = """
[PAGE 4]
She had the ability to solve hard puzzles. Everyone cheered.

---PAGE---

[PAGE 5]
The class absorb new ideas quickly! Their ambition grows every day.
""".strip()

    vocab = enrich_selected_vocab_words(["ability", "absorb", "ambition"], extracted_text, 4)

    assert vocab == [
        {
            "word": "ability",
            "page_number": 4,
            "book_quote": "She had the ability to solve hard puzzles.",
            "grade_band": "4-6",
            "score": 1.0,
        },
        {
            "word": "absorb",
            "page_number": 5,
            "book_quote": "The class absorb new ideas quickly!",
            "grade_band": "4-6",
            "score": 1.0,
        },
        {
            "word": "ambition",
            "page_number": 5,
            "book_quote": "Their ambition grows every day.",
            "grade_band": "4-6",
            "score": 1.0,
        },
    ]


def test_enrich_selected_vocab_words_parses_multiple_page_markers_without_separator():
    extracted_text = """
[PAGE 11]
This paragraph has avoid and another sentence.
[PAGE 12]
You should consider the evidence.
[PAGE 13]
They explore the cave together.
""".strip()

    vocab = enrich_selected_vocab_words(["avoid", "consider", "explore"], extracted_text, 5)

    assert [entry["page_number"] for entry in vocab] == [11, 12, 13]
