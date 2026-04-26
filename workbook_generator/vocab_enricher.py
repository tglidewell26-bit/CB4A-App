"""Enrich selected vocabulary words with page and quote metadata."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Sequence

PAGE_SEPARATOR = "\n\n---PAGE---\n\n"


@dataclass
class VocabularyWord:
    word: str
    page_number: int
    book_quote: str
    grade_band: str
    score: float


def _grade_band(grade_level: int) -> str:
    grade = min(8, max(3, int(grade_level)))
    return f"{grade}-{min(8, grade + 2)}"


def _sentence_quote(text: str, word: str) -> str:
    escaped = re.escape(word)
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    for sentence in sentences:
        if re.search(rf"\b{escaped}\b", sentence, re.IGNORECASE):
            return sentence[:220]
    return text.strip()[:220]


def _parse_chapter_pages(extracted_text: str) -> List[Dict[str, object]]:
    pages: List[Dict[str, object]] = []
    segments = [segment.strip() for segment in extracted_text.split(PAGE_SEPARATOR) if segment.strip()]
    for index, segment in enumerate(segments, start=1):
        marker = re.match(r"^\[PAGE\s+(\d+)\]\s*\n?", segment, flags=re.IGNORECASE)
        if marker:
            page_number = int(marker.group(1))
            text = re.sub(r"^\[PAGE\s+\d+\]\s*\n?", "", segment, flags=re.IGNORECASE).strip()
        else:
            page_number = index
            text = segment
        if text:
            pages.append({"page_number": page_number, "text": text})
    return pages


def enrich_selected_vocab_words(
    words: Sequence[str],
    extracted_text: str,
    grade_level: int,
) -> List[Dict[str, object]]:
    pages = _parse_chapter_pages(extracted_text)
    band = _grade_band(grade_level)
    enriched: List[VocabularyWord] = []

    for word in words:
        hit_page = next(
            (
                page
                for page in pages
                if re.search(rf"\b{re.escape(word)}\b", str(page["text"]), re.IGNORECASE)
            ),
            None,
        )
        if not hit_page:
            continue

        page_number = int(hit_page["page_number"])
        page_text = str(hit_page["text"])
        quote = _sentence_quote(page_text, word)

        enriched.append(
            VocabularyWord(
                word=word,
                page_number=page_number,
                book_quote=quote,
                grade_band=band,
                score=1.0,
            )
        )

    return [asdict(item) for item in enriched]


def _main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to extracted chapter text")
    parser.add_argument("--grade", required=True, type=int)
    parser.add_argument("--words", required=True, help="JSON array of words")
    args = parser.parse_args()

    extracted_text = Path(args.source).read_text(encoding="utf-8", errors="ignore")
    words = json.loads(args.words)
    result = enrich_selected_vocab_words(words, extracted_text, args.grade)
    print(json.dumps({"vocabulary": result}))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
