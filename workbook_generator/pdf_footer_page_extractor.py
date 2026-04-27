from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import fitz  # PyMuPDF


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


def _line_text(words: Sequence[Word]) -> str:
    if not words:
        return ""

    sorted_words = sorted(words, key=lambda w: (round(w.y0, 1), w.x0))
    lines: List[List[str]] = []
    current_line: List[str] = []
    current_y = sorted_words[0].y0

    for word in sorted_words:
        if abs(word.y0 - current_y) > 3.0:
            if current_line:
                lines.append(current_line)
            current_line = [word.text]
            current_y = word.y0
        else:
            current_line.append(word.text)

    if current_line:
        lines.append(current_line)

    return "\n".join(" ".join(tokens).strip() for tokens in lines if tokens).strip()


def _extract_page_number_candidates(words: Sequence[Word], page_width: float, page_height: float) -> List[Tuple[int, float]]:
    bottom_start = page_height * 0.86
    candidates: List[Tuple[int, float]] = []

    for word in words:
        if word.y0 < bottom_start:
            continue
        match = re.fullmatch(r"(?:page\s*)?(\d{1,4})", word.text.strip(), flags=re.IGNORECASE)
        if not match:
            continue

        page_num = int(match.group(1))
        x_center = (word.x0 + word.x1) / 2
        candidates.append((page_num, x_center))

    candidates.sort(key=lambda item: item[1])
    return candidates


def _extract_words(page: fitz.Page) -> List[Word]:
    raw_words = page.get_text("words")
    words: List[Word] = []
    for item in raw_words:
        if len(item) < 5:
            continue
        x0, y0, x1, y1, text = item[:5]
        token = str(text).strip()
        if not token:
            continue
        words.append(Word(float(x0), float(y0), float(x1), float(y1), token))
    return words


def extract_pages(pdf_path: Path) -> List[dict]:
    doc = fitz.open(pdf_path)
    output_pages: List[dict] = []
    fallback_page_number = 1

    for page in doc:
        width = float(page.rect.width)
        height = float(page.rect.height)
        words = _extract_words(page)
        if not words:
            continue

        candidates = _extract_page_number_candidates(words, width, height)

        if len(candidates) >= 2 and (candidates[-1][1] - candidates[0][1]) > (width * 0.35):
            mid_x = width / 2
            left_words = [w for w in words if ((w.x0 + w.x1) / 2) < mid_x]
            right_words = [w for w in words if ((w.x0 + w.x1) / 2) >= mid_x]

            left_num = candidates[0][0]
            right_num = candidates[-1][0]

            left_text = _line_text(left_words)
            right_text = _line_text(right_words)

            if left_text:
                output_pages.append({"page_number": left_num, "text": left_text})
            if right_text:
                output_pages.append({"page_number": right_num, "text": right_text})

            fallback_page_number = max(left_num, right_num) + 1
            continue

        detected_page = candidates[0][0] if candidates else fallback_page_number
        page_text = _line_text(words)
        if page_text:
            output_pages.append({"page_number": detected_page, "text": page_text})
            fallback_page_number = detected_page + 1

    return output_pages


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to PDF file")
    args = parser.parse_args()

    source = Path(args.source)
    pages = extract_pages(source)
    print(json.dumps({"pages": pages}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
