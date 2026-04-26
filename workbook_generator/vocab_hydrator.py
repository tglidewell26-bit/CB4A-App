from __future__ import annotations

import json
import re
import sys
from typing import Dict, List, TypedDict

PAGE_SEPARATOR = "\n\n---PAGE---\n\n"


class VocabularyWord(TypedDict):
    word: str
    lemma: str
    page_number: int
    book_quote: str
    grade_band: str
    score: float


def _normalize(word: str) -> str:
    token = word.lower().strip("'\"-.,;:!?()[]{}")
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("ed") and len(token) > 4:
        return token[:-2]
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and len(token) > 3:
        return token[:-1]
    return token


def _parse_pages(chapter_text: str) -> List[Dict[str, object]]:
    pages: List[Dict[str, object]] = []
    segments = [segment.strip() for segment in chapter_text.split(PAGE_SEPARATOR) if segment.strip()]
    for index, segment in enumerate(segments):
        marker = re.match(r"^\[PAGE\s+(\d+)\]\s*\n?", segment, flags=re.IGNORECASE)
        page_number = int(marker.group(1)) if marker else index + 1
        page_text = re.sub(r"^\[PAGE\s+\d+\]\s*\n?", "", segment, flags=re.IGNORECASE).strip()
        if page_text:
            pages.append({"page_number": page_number, "text": page_text})
    return pages


def _find_sentence(text: str, word: str) -> str:
    escaped = re.escape(word)
    sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]
    for sentence in sentences:
        if re.search(rf"\b{escaped}\b", sentence, flags=re.IGNORECASE):
            return sentence[:220]
    return text[:220].strip()


def hydrate_vocab_words(chapter_text: str, words: List[str], grade_level: int) -> List[VocabularyWord]:
    pages = _parse_pages(chapter_text)
    grade_band = f"{grade_level}-{grade_level + 2}"
    hydrated: List[VocabularyWord] = []

    for idx, word in enumerate(words):
        located_page = 1
        located_quote = ""
        for page in pages:
            page_text = str(page["text"])
            if re.search(rf"\b{re.escape(word)}\b", page_text, flags=re.IGNORECASE):
                located_page = int(page["page_number"])
                located_quote = _find_sentence(page_text, word)
                break

        if not located_quote and pages:
            located_page = int(pages[0]["page_number"])
            located_quote = _find_sentence(str(pages[0]["text"]), word)

        hydrated.append(
            {
                "word": word,
                "lemma": _normalize(word),
                "page_number": located_page,
                "book_quote": located_quote,
                "grade_band": grade_band,
                "score": round(max(0.1, 1.0 - idx * 0.05), 4),
            }
        )

    return hydrated


def _main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    chapter_text = str(payload.get("chapter_text", ""))
    words = [str(item) for item in payload.get("words", [])]
    grade_level = int(payload.get("grade_level", 5))
    hydrated = hydrate_vocab_words(chapter_text=chapter_text, words=words, grade_level=grade_level)
    sys.stdout.write(json.dumps({"vocabulary": hydrated}))


if __name__ == "__main__":
    _main()
