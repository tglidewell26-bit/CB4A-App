"""Deterministic chapter vocabulary selector.

Selects up to 10 words from a grade-banded vocabulary list that are present in
chapter text. Also supports PDF text extraction for file-based flows.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Set

import pdfplumber

GRADE_VOCAB: Dict[int, Sequence[str]] = {
    3: [
        "adventure", "brave", "cabin", "cheerful", "climb", "cottage", "curious", "distant", "eager", "gentle",
        "grumble", "hollow", "lantern", "meadow", "murmur", "narrow", "pleasant", "rapid", "rustic", "sturdy",
    ],
    4: [
        "astonished", "careful", "content", "delightful", "drifted", "earnest", "fierce", "gloomy", "graceful", "hesitate",
        "journey", "kindness", "lively", "mischief", "nonsense", "observe", "patient", "quarrel", "reluctant", "shelter",
    ],
    5: [
        "abandoned", "anxious", "awkward", "bitter", "cozy", "companion", "confident", "encouraged", "frustrated", "guided",
        "inherit", "inherited", "nimble", "breathtaking", "stern", "gruff", "attire", "tremble", "uneasy", "weary",
    ],
    6: [
        "accurate", "bewildered", "consequence", "determined", "eloquent", "forbidden", "generous", "hostile", "inquiry", "logical",
        "melancholy", "notion", "obvious", "persuade", "questionable", "resolute", "sincere", "tension", "urgent", "vivid",
    ],
    7: [
        "ambition", "apparent", "compelled", "dignity", "elaborate", "foreshadow", "grim", "hypothesis", "illusion", "intense",
        "justice", "kinship", "lament", "motive", "ominous", "paradox", "reconcile", "sarcastic", "symbolic", "vulnerable",
    ],
    8: [
        "analogy", "arbitrary", "coherent", "complexity", "contradiction", "deceptive", "empathy", "fragmented", "ideology", "inevitable",
        "manipulate", "nuance", "oppressive", "perspective", "resilience", "rhetorical", "scrutiny", "subtle", "transformation", "validate",
    ],
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")


def extract_pdf_text(pdf_path: str) -> str:
    """Extract text from a PDF file."""
    parts: List[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                parts.append(page_text.strip())
    return "\n\n".join(parts)


def normalize_word(word: str) -> str:
    """Normalize for matching and de-duplication."""
    return re.sub(r"[^a-z]", "", word.lower())


def tokenize_text(text: str) -> List[str]:
    """Tokenize text into raw words."""
    return WORD_RE.findall(text)


def _read_text_source(source_path: str) -> str:
    path = Path(source_path)
    if not path.exists():
        raise FileNotFoundError(f"Text source does not exist: {source_path}")
    if path.suffix.lower() == ".pdf":
        return extract_pdf_text(source_path)
    return path.read_text(encoding="utf-8", errors="ignore")


def select_vocab_words(source_path: str, grade_level: int) -> List[str]:
    """Return up to 10 selected vocabulary words found in the chapter text."""
    grade = min(8, max(3, int(grade_level)))
    chapter_text = _read_text_source(source_path)
    tokens = tokenize_text(chapter_text)
    chapter_vocab: Set[str] = {normalize_word(token) for token in tokens if normalize_word(token)}

    picked: List[str] = []
    seen: Set[str] = set()
    for candidate in GRADE_VOCAB[grade]:
        norm = normalize_word(candidate)
        if norm in chapter_vocab and norm not in seen:
            picked.append(candidate)
            seen.add(norm)
        if len(picked) == 10:
            break
    return picked


def _main() -> int:
    import argparse
    import json

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to source .pdf or .txt file")
    parser.add_argument("--grade", required=True, type=int)
    args = parser.parse_args()

    selected = select_vocab_words(args.source, args.grade)
    print(json.dumps({"words": selected}))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
