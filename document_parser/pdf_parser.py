"""
PDF parser using pdfplumber.

Each PDF page maps 1-to-1 to a physical page, so page numbers are exact.
Text is extracted per-page and lightly cleaned (collapsed blank lines,
stripped leading/trailing whitespace) without altering word order or content.
"""

import re
from typing import List, Dict, Any

import pdfplumber


def _clean_page_text(raw: str) -> str:
    """Remove excessive whitespace while preserving paragraph breaks."""
    # Normalise line endings
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse runs of blank lines to a single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF, one entry per page.

    Returns a list of dicts:
        {
            "page_number": int,   # 1-based physical page number
            "text": str,          # cleaned text for that page
            "word_count": int
        }

    Raises ValueError if the file cannot be opened or contains no extractable text.
    """
    pages = []

    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages:
            raise ValueError("PDF appears to be empty or could not be read.")

        for page in pdf.pages:
            raw_text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
            cleaned = _clean_page_text(raw_text)
            word_count = len(cleaned.split()) if cleaned else 0

            pages.append(
                {
                    "page_number": page.page_number,  # pdfplumber is 1-based
                    "text": cleaned,
                    "word_count": word_count,
                }
            )

    if not any(p["text"] for p in pages):
        raise ValueError(
            "No extractable text found in PDF. "
            "The file may be a scanned image without an OCR layer."
        )

    return pages
