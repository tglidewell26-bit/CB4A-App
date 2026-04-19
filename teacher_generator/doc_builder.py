import io
from typing import Any, Dict

from docx import Document
from docx.shared import Pt


def _header(doc: Document, title: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(f"=== {title} ===")
    run.bold = True
    run.font.size = Pt(12)


def _text(doc: Document, text: str) -> None:
    doc.add_paragraph(text or "—")


def _line(doc: Document, label: str, value: str) -> None:
    p = doc.add_paragraph()
    r = p.add_run(f"{label}: ")
    r.bold = True
    p.add_run(value or "—")


def build_docx(parsed: Dict[str, Any], chapter_json: Dict[str, Any], grade: int) -> io.BytesIO:
    doc = Document()

    t = doc.add_paragraph()
    tr = t.add_run(f"Teacher Guide — {chapter_json.get('book_title', '')}")
    tr.bold = True
    tr.font.size = Pt(16)
    doc.add_paragraph(
        f"Chapter {chapter_json.get('chapter_num', '')}: {chapter_json.get('chapter_title', '')} | Grade {grade}"
    )

    _header(doc, "LESSON OVERVIEW")
    _text(doc, parsed.get("lesson_overview", ""))

    _header(doc, "MEASURABLE OBJECTIVES")
    _text(doc, "Students will be able to:")
    _text(doc, parsed.get("measurable_objectives", ""))

    _header(doc, "STANDARDS LIST")
    _text(doc, parsed.get("standards_list", ""))

    _header(doc, "MATERIALS NEEDED")
    _text(doc, parsed.get("materials_needed", ""))

    _header(doc, "GET READY TO READ")
    _text(doc, parsed.get("get_ready_to_read", ""))

    _header(doc, "VOCABULARY MINI-LESSON")
    _line(doc, "Introduce with context", parsed.get("vocab_intro", ""))
    _line(doc, "Partner practice", parsed.get("vocab_partner_practice", ""))
    _line(doc, "Quick check", parsed.get("vocab_quick_check", ""))
    for i, word in enumerate(parsed.get("vocabulary", []), start=1):
        _line(doc, f"Word {i}", f"{word.get('WORD', '')} (page {word.get('PAGE', '')})")
        _line(doc, "Kid-friendly definition", word.get("KID_FRIENDLY_DEFINITION", ""))
        _line(doc, "Context sentence", word.get("CONTEXT_SENTENCE", ""))
        _line(doc, "Example sentence", word.get("EXAMPLE_SENTENCE", ""))
    _line(doc, "Differentiation — Struggling Readers", parsed.get("vocab_diff_struggling", ""))
    _line(doc, "Differentiation — ELL Students", parsed.get("vocab_diff_ell", ""))
    _line(doc, "Differentiation — Advanced", parsed.get("vocab_diff_advanced", ""))

    _header(doc, "GUIDED READING")
    for sec in parsed.get("guided_sections", []):
        _header(doc, f"GUIDED READING SECTION {sec.get('SECTION_NUMBER', '')}")
        _line(doc, "Pages", sec.get("PAGE_RANGE", ""))
        _line(doc, "Read from", sec.get("READ_FROM", ""))
        _line(doc, "Read to", sec.get("READ_TO", ""))
        _line(doc, "Pause questions", sec.get("PAUSE_QUESTIONS", ""))
    _line(doc, "Teaching tip", parsed.get("guided_tip", ""))
    _line(doc, "Differentiation — Struggling Readers", parsed.get("guided_diff_struggling", ""))
    _line(doc, "Differentiation — ELL Students", parsed.get("guided_diff_ell", ""))
    _line(doc, "Differentiation — Advanced", parsed.get("guided_diff_advanced", ""))

    _header(doc, "TIERED DISCUSSION")
    _line(doc, "Level 1 — Literal", parsed.get("tiered_level_1", ""))
    _line(doc, "Level 2 — Inferential", parsed.get("tiered_level_2", ""))
    _line(doc, "Level 3 — Analytical", parsed.get("tiered_level_3", ""))
    _line(doc, "Level 4 — Personal", parsed.get("tiered_level_4", ""))
    _line(doc, "Discussion management notes", parsed.get("tiered_management", ""))

    _header(doc, "THINK ABOUT THE STORY — ANSWER KEY")
    _text(doc, parsed.get("think_about_answers", ""))

    _header(doc, "READING BETWEEN THE LINES — ANSWER KEY")
    _text(doc, parsed.get("reading_between_answers", ""))

    _header(doc, "DIG DEEPER — ANSWER KEY")
    _text(doc, parsed.get("dig_deeper_answers", ""))

    _header(doc, "MULTIPLE CHOICE ANSWERS")
    _text(doc, parsed.get("multiple_choice_answers", ""))

    _header(doc, "SHORT ANSWER ANSWERS")
    _text(doc, parsed.get("short_answer_answers", ""))

    _header(doc, "CREATIVE RESPONSE GUIDE")
    _text(doc, parsed.get("creative_response_guide", ""))

    _header(doc, "CHARACTER CHART ANSWER KEY")
    _text(doc, parsed.get("character_chart_answer_key", ""))

    _header(doc, "TIMELINE ANSWER KEY")
    _text(doc, parsed.get("timeline_answer_key", ""))

    _header(doc, "EXIT TICKET GUIDE")
    _text(doc, parsed.get("exit_ticket_guide", ""))

    _header(doc, "DIFFERENTIATION SUMMARY")
    _text(doc, parsed.get("differentiation_summary", ""))

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
