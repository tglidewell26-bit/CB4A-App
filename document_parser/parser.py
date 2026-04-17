"""
Main document parser dispatcher.

Accepts a file path, detects type by extension, delegates to the appropriate
sub-parser, and returns a normalised JSON-serialisable dict.

Output schema
─────────────
{
    "metadata": {
        "filename":    str,          # original uploaded filename
        "file_type":   "pdf"|"docx", # normalised type
        "total_pages": int,          # number of pages found
        "total_words": int,          # document-wide word count
        "parsed_at":   str           # ISO-8601 UTC timestamp
    },
    "pages": [
        {
            "page_number": int,      # 1-based physical page number
            "text":        str,      # clean page text
            "word_count":  int
        },
        ...
    ],
    "full_text": str                 # all pages joined with page-break markers,
                                     # ready to pass to the Claude API
}

The "full_text" field uses the marker  <<<PAGE {n}>>>  before each page so
that downstream prompts can instruct the model to cite page numbers accurately.
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict

from document_parser.pdf_parser import parse_pdf
from document_parser.docx_parser import parse_docx


class ParserError(Exception):
    """Raised for user-facing parse failures (invalid file, no text, etc.)."""


_SUPPORTED_EXTENSIONS = {
    "pdf": "pdf",
    "docx": "docx",
    "doc": "docx",   # treat legacy .doc as docx (user should re-save first)
}


def _detect_type(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lstrip(".").lower()
    if ext not in _SUPPORTED_EXTENSIONS:
        raise ParserError(
            f"Unsupported file extension '.{ext}'. "
            "Please upload a PDF (.pdf) or Word document (.docx)."
        )
    return _SUPPORTED_EXTENSIONS[ext]


def _build_full_text(pages: list) -> str:
    """
    Concatenate all pages with clear page markers.

    Format used:
        <<<PAGE 1>>>
        ...text...

        <<<PAGE 2>>>
        ...text...
    """
    parts = []
    for page in pages:
        n = page["page_number"]
        text = page["text"]
        if text:
            parts.append(f"<<<PAGE {n}>>>\n{text}")
    return "\n\n".join(parts)


def parse_document(file_path: str, original_filename: str = "") -> Dict[str, Any]:
    """
    Parse a PDF or Word document and return a structured dict.

    Args:
        file_path:         Absolute path to the (temp) file on disk.
        original_filename: The user-supplied filename, used in metadata.

    Returns:
        Normalised dict matching the output schema above.

    Raises:
        ParserError: For all expected failure modes (bad type, no text, etc.).
    """
    file_type = _detect_type(file_path)

    try:
        if file_type == "pdf":
            pages = parse_pdf(file_path)
        else:
            pages = parse_docx(file_path)
    except ValueError as e:
        raise ParserError(str(e)) from e
    except Exception as e:
        raise ParserError(
            f"Failed to parse {file_type.upper()} file: {str(e)}"
        ) from e

    total_words = sum(p["word_count"] for p in pages)
    full_text = _build_full_text(pages)
    parsed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "metadata": {
            "filename": original_filename or os.path.basename(file_path),
            "file_type": file_type,
            "total_pages": len(pages),
            "total_words": total_words,
            "parsed_at": parsed_at,
        },
        "pages": pages,
        "full_text": full_text,
    }
