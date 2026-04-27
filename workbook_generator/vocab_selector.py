from __future__ import annotations

import json
import re
import sys
from collections import Counter
from typing import Dict, List

# Grade-banded target vocabulary pools (grades 3-8).
GRADE_VOCAB: Dict[int, List[str]] = {
    3: [
        "adventure", "curious", "discover", "journey", "mystery", "brave", "gentle", "whisper",
        "shimmer", "meadow", "pattern", "rescue", "forest", "signal", "lesson", "fragile",
    ],
    4: [
        "anxious", "consider", "observe", "predict", "resource", "benefit", "influence", "complex",
        "persist", "method", "evidence", "contrast", "process", "typical", "impact", "strategy",
    ],
    5: [
        "cozy", "guided", "encouraged", "frustrated", "inherited", "nimble", "attire", "gruff",
        "breathtaking", "stern", "analyze", "interpret", "significant", "maintain", "perspective", "evaluate",
    ],
    6: [
        "construct", "justify", "priority", "consequence", "reliable", "emerge", "adapt", "context",
        "dimension", "estimate", "intense", "notion", "sustain", "transform", "coherent", "variable",
    ],
    7: [
        "accumulate", "advocate", "contradict", "derive", "emphasize", "hypothesis", "implement", "interact",
        "motive", "noteworthy", "relevant", "sequence", "sufficient", "theory", "underlying", "valid",
    ],
    8: [
        "ambiguous", "articulate", "comprehensive", "correlate", "deduce", "elaborate", "evaluate", "framework",
        "inference", "innovative", "nuance", "objective", "plausible", "synthesize", "substantiate", "viable",
    ],
}


def normalize_token(token: str) -> str:
    return re.sub(r"[^a-z]", "", token.lower())


def lemmatize(token: str) -> str:
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


def select_vocab_words(text: str, grade_level: int) -> List[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text)
    normalized_tokens = [normalize_token(t) for t in tokens]
    normalized_tokens = [t for t in normalized_tokens if t]
    token_counts = Counter(normalized_tokens)
    token_set = set(normalized_tokens)

    grade = min(8, max(3, int(grade_level)))
    selected: List[str] = []
    seen = set()

    for candidate in GRADE_VOCAB.get(grade, []):
        lemma = lemmatize(candidate)
        if candidate in token_set:
            choice = candidate
        elif lemma in token_set:
            choice = lemma
        else:
            continue

        if choice not in seen:
            selected.append(choice)
            seen.add(choice)
        if len(selected) >= 10:
            return selected

    # Fallback: chapter-present words by length/frequency to fill up to 10.
    fallback = sorted(
        (word for word, count in token_counts.items() if len(word) >= 5 and count >= 1),
        key=lambda w: (-token_counts[w], -len(w), w),
    )

    for word in fallback:
        lemma = lemmatize(word)
        candidate = lemma if lemma in token_set else word
        if candidate in seen:
            continue
        selected.append(candidate)
        seen.add(candidate)
        if len(selected) >= 10:
            break

    return selected


def main() -> None:
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to extracted chapter text")
    parser.add_argument("--grade", required=True, type=int)
    args = parser.parse_args()

    text = Path(args.source).read_text(encoding="utf-8", errors="ignore")
    words = select_vocab_words(text, args.grade)
    print(json.dumps({"words": words}))


if __name__ == "__main__":
    main()
