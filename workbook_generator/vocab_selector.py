from __future__ import annotations

import json
import re
import sys
from collections import Counter
from typing import Dict, List, Set

GRADE_VOCAB: Dict[int, List[str]] = {
    3: [
        "adventure", "brave", "careful", "courage", "discover", "effort", "gentle", "journey",
        "kindness", "mystery", "notice", "patient", "respect", "sudden", "wonder", "whisper",
    ],
    4: [
        "astonished", "compare", "consider", "curious", "decide", "delicate", "fortunate", "graceful",
        "hesitate", "imagine", "increase", "method", "observe", "predict", "remarkable", "responsible",
    ],
    5: [
        "analyze", "approach", "benefit", "challenge", "consequence", "determine", "evidence", "frustrated",
        "guided", "inherited", "influence", "interpret", "maintain", "nimble", "persuade", "strategy",
    ],
    6: [
        "abundant", "attire", "breathtaking", "complex", "contrast", "critical", "demonstrate", "evaluate",
        "justify", "perspective", "precise", "significant", "stern", "summarize", "sustain", "transfer",
    ],
    7: [
        "coherent", "contextual", "derive", "elaborate", "emphasize", "hypothesis", "infer", "integrate",
        "nuance", "objective", "paradox", "plausible", "refine", "synthesize", "theoretical", "validate",
    ],
    8: [
        "ambiguous", "articulate", "contemporary", "criterion", "divergent", "explicit", "formulate", "implication",
        "inference", "metaphor", "optimize", "parallel", "rhetorical", "substantiate", "transform", "variable",
    ],
}

STOPWORDS: Set[str] = {
    "about", "above", "after", "again", "against", "all", "also", "always", "among", "an", "and", "any", "are",
    "around", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has",
    "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so",
    "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
    "while", "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves",
}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text)


def _normalize(token: str) -> str:
    return token.lower().strip("'\"-.,;:!?()[]{}")


def select_vocab_words(text: str, grade_level: int) -> List[str]:
    tokens = _tokenize(text)
    if not tokens:
        return []

    normalized_tokens = [_normalize(token) for token in tokens]
    token_counts = Counter(normalized_tokens)
    token_display: Dict[str, str] = {}
    for token in tokens:
        normalized = _normalize(token)
        token_display.setdefault(normalized, token)

    grade_words = GRADE_VOCAB.get(grade_level, GRADE_VOCAB[5])
    selected: List[str] = []
    used: Set[str] = set()

    for word in grade_words:
        normalized = _normalize(word)
        if normalized in token_counts and normalized not in used:
            selected.append(token_display.get(normalized, word))
            used.add(normalized)
        if len(selected) == 10:
            return selected

    fallback_candidates = sorted(
        (
            word for word, count in token_counts.items()
            if len(word) >= 5 and word not in STOPWORDS and count >= 2 and word not in used
        ),
        key=lambda w: (-token_counts[w], -len(w), w),
    )

    for candidate in fallback_candidates:
        selected.append(token_display.get(candidate, candidate))
        used.add(candidate)
        if len(selected) == 10:
            break

    return selected


def _main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    text = str(payload.get("text", ""))
    grade_level = int(payload.get("grade_level", 5))
    words = select_vocab_words(text=text, grade_level=grade_level)
    sys.stdout.write(json.dumps({"words": words}))


if __name__ == "__main__":
    _main()
