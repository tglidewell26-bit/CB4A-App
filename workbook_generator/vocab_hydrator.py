from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import Dict, List, TypedDict


class PageText(TypedDict):
    page_number: int
    text: str


@dataclass
class VocabularyWord:
    word: str
    lemma: str
    page_number: int
    book_quote: str
    grade_band: str
    score: float


def lemmatize(token: str) -> str:
    token = token.lower()
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


def sentence_quote(text: str, word: str) -> str:
    pattern = re.compile(rf"\b{re.escape(word)}\b", re.IGNORECASE)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for sentence in sentences:
        if pattern.search(sentence):
            return sentence.strip()[:220]
    return text.strip()[:220]


def find_display_hit(page_text: str, target: str) -> str | None:
    pattern = re.compile(rf"\b{re.escape(target)}\b", re.IGNORECASE)
    match = pattern.search(page_text)
    if not match:
        return None
    return page_text[match.start():match.end()]


def hydrate_vocabulary(words: List[str], chapter_pages: List[PageText], grade_level: int) -> List[Dict[str, object]]:
    min_grade = min(8, max(3, int(grade_level)))
    max_grade = min_grade + 2

    frequencies: Dict[str, int] = {}
    for page in chapter_pages:
        tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", page["text"])
        for token in tokens:
            lower = token.lower()
            frequencies[lower] = frequencies.get(lower, 0) + 1

    hydrated: List[Dict[str, object]] = []
    for word in words:
        found_page = None
        found_display = None
        for page in chapter_pages:
            display = find_display_hit(page["text"], word)
            if display:
                found_page = page
                found_display = display
                break

        if not found_page or not found_display:
            continue

        freq = frequencies.get(found_display.lower(), 1)
        score = round(min(1.0, 0.45 + 0.1 * freq + 0.02 * len(found_display)), 4)
        hydrated.append(
            {
                "word": found_display,
                "lemma": lemmatize(found_display),
                "page_number": int(found_page["page_number"]),
                "book_quote": sentence_quote(found_page["text"], found_display),
                "grade_band": f"{min_grade}-{max_grade}",
                "score": score,
            }
        )

    return hydrated


def main() -> None:
    payload = json.load(sys.stdin)
    words = [str(word) for word in payload.get("words", [])]
    chapter_pages = payload.get("chapter_pages", [])
    grade_level = int(payload.get("grade_level", 3))
    vocabulary = hydrate_vocabulary(words, chapter_pages, grade_level)
    json.dump({"vocabulary": vocabulary}, sys.stdout)


if __name__ == "__main__":
    main()
