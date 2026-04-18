"""
Word document builder for the Student Workbook.

Creates a .docx with every slot clearly labeled so the user can copy-paste
into an InDesign template.  Layout matches the specification:

    === SECTION NAME ===
    Label: content
    ...

python-docx is used directly (no template required).
"""

import io
from typing import Any, Dict, List

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH


# ── Style helpers ─────────────────────────────────────────────────────────────

def _section_header(doc: Document, title: str) -> None:
    """Add a bold, clearly delimited section header paragraph."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(f"=== {title} ===")
    run.bold = True
    run.font.size = Pt(12)


def _labeled_line(doc: Document, label: str, value: str) -> None:
    """Add a paragraph with a bold label followed by normal value text."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    bold_run = p.add_run(f"{label}: ")
    bold_run.bold = True
    p.add_run(value or "—")


def _plain(doc: Document, text: str) -> None:
    p = doc.add_paragraph(text or "—")
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(2)


def _divider(doc: Document) -> None:
    doc.add_paragraph()


# ── Section renderers ─────────────────────────────────────────────────────────

def _render_focus_question(doc: Document, data: Dict[str, Any]) -> None:
    _section_header(doc, "FOCUS QUESTION")
    _plain(doc, data.get("focus_question", ""))


def _render_vocabulary(doc: Document, data: Dict[str, Any]) -> None:
    for i, vocab in enumerate(data.get("vocabulary", []), start=1):
        _section_header(doc, f"VOCABULARY WORD {i}")
        _labeled_line(doc, "Word", vocab.get("WORD", ""))
        _labeled_line(doc, "Book quote", vocab.get("BOOK_QUOTE", ""))
        _labeled_line(doc, "Definition", vocab.get("DEFINITION", ""))
        _labeled_line(doc, "Example sentence", vocab.get("EXAMPLE_SENTENCE", ""))


def _render_question_list(
    doc: Document,
    section_label: str,
    questions: List[Dict[str, str]],
    has_answer: bool = True,
) -> None:
    for i, q in enumerate(questions, start=1):
        _section_header(doc, f"{section_label} Q{i}")
        _labeled_line(doc, "Question", q.get("QUESTION", ""))
        if has_answer:
            _labeled_line(doc, "Answer", q.get("ANSWER", ""))


def _render_multiple_choice(doc: Document, data: Dict[str, Any]) -> None:
    for i, mc in enumerate(data.get("multiple_choice", []), start=1):
        _section_header(doc, f"MULTIPLE CHOICE Q{i}")
        _labeled_line(doc, "Question", mc.get("QUESTION", ""))
        _labeled_line(doc, "Option A", mc.get("OPTION_A", ""))
        _labeled_line(doc, "Option B", mc.get("OPTION_B", ""))
        _labeled_line(doc, "Option C", mc.get("OPTION_C", ""))
        _labeled_line(doc, "Option D", mc.get("OPTION_D", ""))
        _labeled_line(doc, "Correct answer", mc.get("CORRECT_ANSWER", ""))


def _render_creative_response(doc: Document, data: Dict[str, Any]) -> None:
    _section_header(doc, "CREATIVE RESPONSE PROMPT")
    cr = data.get("creative_response", {})
    _labeled_line(doc, "Prompt", cr.get("PROMPT", ""))
    _labeled_line(doc, "Hint 1", cr.get("HINT_1", ""))
    _labeled_line(doc, "Hint 2", cr.get("HINT_2", ""))
    _labeled_line(doc, "Hint 3", cr.get("HINT_3", ""))


def _render_timeline(doc: Document, data: Dict[str, Any]) -> None:
    _section_header(doc, "TIMELINE EVENTS")
    for i, event in enumerate(data.get("timeline_events", []), start=1):
        _labeled_line(doc, f"Event {i}", event)


def _render_prediction(doc: Document, data: Dict[str, Any]) -> None:
    _section_header(doc, "PREDICTION SETUP")
    _plain(doc, data.get("prediction_setup", ""))


# ── Title block ───────────────────────────────────────────────────────────────

def _render_title_block(doc: Document, chapter_json: Dict[str, Any], grade: int) -> None:
    title_para = doc.add_paragraph()
    title_run = title_para.add_run(
        f"{chapter_json.get('book_title', 'Student Workbook')}"
    )
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub_para = doc.add_paragraph()
    sub_para.add_run(
        f"By {chapter_json.get('author', '')}  •  "
        f"Chapter {chapter_json.get('chapter_num', '')} — "
        f"{chapter_json.get('chapter_title', '')}  •  "
        f"Grade {grade}  •  "
        f"Pages {chapter_json.get('page_range', '')}"
    )
    sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()  # breathing room


# ── Public API ────────────────────────────────────────────────────────────────

def build_docx(parsed_workbook: Dict[str, Any], chapter_json: Dict[str, Any], grade: int) -> io.BytesIO:
    """
    Render the parsed workbook dict into a .docx and return it as BytesIO.

    Sections appear in the order specified in the CB4A Student Workbook layout.
    """
    doc = Document()

    # Narrow margins for more content per page
    for section in doc.sections:
        section.top_margin = Pt(36)
        section.bottom_margin = Pt(36)
        section.left_margin = Pt(54)
        section.right_margin = Pt(54)

    _render_title_block(doc, chapter_json, grade)

    _render_focus_question(doc, parsed_workbook)
    _render_vocabulary(doc, parsed_workbook)
    _render_question_list(doc, "BASIC COMPREHENSION", parsed_workbook.get("basic_comprehension", []))
    _render_question_list(doc, "INFERENCE QUESTION", parsed_workbook.get("inference_questions", []))
    _render_question_list(doc, "ANALYSIS QUESTION", parsed_workbook.get("analysis_questions", []))
    _render_multiple_choice(doc, parsed_workbook)
    _render_question_list(doc, "SHORT ANSWER", parsed_workbook.get("short_answer", []))
    _render_creative_response(doc, parsed_workbook)
    _render_timeline(doc, parsed_workbook)
    _render_prediction(doc, parsed_workbook)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
