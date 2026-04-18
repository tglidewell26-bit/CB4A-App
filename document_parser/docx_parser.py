"""
Word document parser using python-docx.

Word doesn't store page numbers in the XML directly — page layout is computed
by the rendering engine at display time.  The most reliable signal available
in the raw XML is the <w:lastRenderedPageBreak> element, which Word inserts
when it saves a document to record where each page ended in the last render.

Strategy:
  1. Walk every paragraph and run in document order.
  2. Before appending run text, check for lastRenderedPageBreak in that run's XML.
     When found, finalise the current page and start a new one.
  3. Also honour explicit <w:pageBreak> (w:br w:type="page") elements.
  4. Text inside headers, footers, text boxes, and footnotes is skipped so the
     output stays clean for AI consumption.

This gives page numbers that match the physical pages Word last rendered,
which is accurate enough for citation purposes provided the document was saved
after its final layout (the normal case for book chapters).
"""

import re
from typing import List, Dict, Any

from docx import Document
from docx.oxml.ns import qn
from lxml import etree


# ── XML helpers ──────────────────────────────────────────────────────────────

_PAGE_BREAK_TAGS = {qn("w:lastRenderedPageBreak"), qn("w:br")}


def _run_has_page_break(run_xml: etree._Element) -> bool:
    """Return True if this run starts a new page (explicit or last-rendered)."""
    for child in run_xml:
        tag = child.tag
        if tag == qn("w:lastRenderedPageBreak"):
            return True
        if tag == qn("w:br"):
            br_type = child.get(qn("w:type"), "")
            if br_type == "page":
                return True
    return False


def _paragraph_text_with_breaks(para_xml: etree._Element):
    """
    Yield (is_page_break: bool, text: str) for each run in a paragraph.

    is_page_break=True means this run begins after a page boundary.
    """
    for child in para_xml:
        if child.tag == qn("w:r"):
            # Check for page break marker before collecting text
            breaks_page = _run_has_page_break(child)
            # Gather text nodes within this run
            text_parts = []
            for t in child.iter(qn("w:t")):
                text_parts.append(t.text or "")
            yield breaks_page, "".join(text_parts)
        elif child.tag == qn("w:hyperlink"):
            # Inline hyperlinks contain runs; treat same as normal runs
            for run in child.iter(qn("w:r")):
                breaks_page = _run_has_page_break(run)
                text_parts = [t.text or "" for t in run.iter(qn("w:t"))]
                yield breaks_page, "".join(text_parts)


# ── Clean-up ─────────────────────────────────────────────────────────────────

def _clean_page_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Main parser ───────────────────────────────────────────────────────────────

def parse_docx(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a .docx file, one entry per rendered page.

    Returns a list of dicts:
        {
            "page_number": int,   # 1-based
            "text": str,
            "word_count": int
        }

    Falls back to treating the entire document as page 1 when no page-break
    markers are found (e.g. a document that was never fully rendered by Word).
    """
    doc = Document(file_path)

    pages: List[str] = [""]  # pages[0] = page 1 accumulator
    current_page_lines: List[str] = []

    def _flush_para():
        """Add a paragraph separator between paragraphs on the same page."""
        nonlocal current_page_lines
        # Will be joined later; just mark paragraph boundary
        current_page_lines.append("")

    def _new_page():
        nonlocal current_page_lines
        pages[-1] = "\n".join(current_page_lines)
        current_page_lines = []
        pages.append("")

    body = doc.element.body
    current_line_buf: List[str] = []

    for para in body.iter(qn("w:p")):
        # Skip paragraphs inside headers/footers/text-boxes/footnotes
        ancestor_tags = {a.tag for a in para.iterancestors()}
        skip_tags = {
            qn("w:hdr"), qn("w:ftr"),
            qn("w:txbxContent"),
            qn("w:footnote"), qn("w:endnote"),
        }
        if ancestor_tags & skip_tags:
            continue

        current_line_buf = []
        para_started_new_page = False

        for is_break, text in _paragraph_text_with_breaks(para):
            if is_break and not para_started_new_page:
                # Flush accumulated line onto current page, then advance
                current_page_lines.append("".join(current_line_buf))
                current_line_buf = []
                _new_page()
                para_started_new_page = True
            current_line_buf.append(text)

        line = "".join(current_line_buf).strip()
        current_page_lines.append(line)

    # Flush the last page
    pages[-1] = "\n".join(current_page_lines)

    # Build output list
    result = []
    for idx, raw_text in enumerate(pages, start=1):
        cleaned = _clean_page_text(raw_text)
        result.append(
            {
                "page_number": idx,
                "text": cleaned,
                "word_count": len(cleaned.split()) if cleaned else 0,
            }
        )

    if not any(p["text"] for p in result):
        raise ValueError("No extractable text found in the Word document.")

    return result
