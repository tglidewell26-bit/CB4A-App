#!/usr/bin/env python3
"""
Test the Student Workbook Generator against the Heidi Chapter 1 sample JSON.

Usage (from the CB4A-App root directory):
    ANTHROPIC_API_KEY=sk-... python tests/run_test.py

The generated .docx is saved to tests/heidi_ch1_workbook.docx.
"""

import json
import logging
import os
import sys
import textwrap

# Ensure the project root is on the path when running from any directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)

from workbook_generator.generator import generate_student_workbook, GeneratorError
from workbook_generator.response_parser import parse_workbook_response

SAMPLE_JSON = os.path.join(os.path.dirname(__file__), "heidi_ch1_sample.json")
OUTPUT_DOCX = os.path.join(os.path.dirname(__file__), "heidi_ch1_workbook.docx")


def _check_api_key() -> bool:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or not key.startswith("sk-"):
        print(
            "\n⚠  ANTHROPIC_API_KEY is not set or looks invalid.\n"
            "   Export it before running this script:\n"
            "       export ANTHROPIC_API_KEY=sk-ant-...\n"
        )
        return False
    return True


def _print_section(title: str, content: str | list, max_chars: int = 120) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")
    if isinstance(content, list):
        for item in content:
            print(f"  • {str(item)[:max_chars]}")
    else:
        wrapped = textwrap.fill(str(content), width=80, initial_indent="  ", subsequent_indent="  ")
        print(wrapped[:max_chars * 3])


def _summarise_workbook(parsed: dict) -> None:
    """Print a human-readable summary of every generated section."""
    print("\n" + "═" * 60)
    print("  WORKBOOK GENERATION SUMMARY")
    print("═" * 60)

    _print_section("FOCUS QUESTION", parsed.get("focus_question", "MISSING"))

    vocab = parsed.get("vocabulary", [])
    print(f"\n{'─' * 60}")
    print(f"  VOCABULARY ({len([v for v in vocab if v.get('WORD')])} / 10 words)")
    print(f"{'─' * 60}")
    for i, v in enumerate(vocab, 1):
        word = v.get("WORD", "—")
        quote = v.get("BOOK_QUOTE", "—")
        defn = v.get("DEFINITION", "—")
        print(f"  {i:2}. {word}")
        print(f"      Quote : {quote[:80]}")
        print(f"      Def   : {defn[:80]}")

    for label, key, n in [
        ("BASIC COMPREHENSION", "basic_comprehension", 6),
        ("INFERENCE QUESTIONS", "inference_questions", 3),
        ("ANALYSIS QUESTIONS", "analysis_questions", 3),
        ("SHORT ANSWER", "short_answer", 3),
    ]:
        qs = parsed.get(key, [])
        filled = [q for q in qs if q.get("QUESTION")]
        print(f"\n{'─' * 60}")
        print(f"  {label} ({len(filled)} / {n} questions)")
        print(f"{'─' * 60}")
        for i, q in enumerate(qs, 1):
            print(f"  Q{i}: {q.get('QUESTION', '—')[:90]}")
            print(f"      {q.get('ANSWER', '—')[:90]}")

    mc = parsed.get("multiple_choice", [])
    filled_mc = [q for q in mc if q.get("QUESTION")]
    print(f"\n{'─' * 60}")
    print(f"  MULTIPLE CHOICE ({len(filled_mc)} / 3 questions)")
    print(f"{'─' * 60}")
    for i, q in enumerate(mc, 1):
        correct = q.get("CORRECT_ANSWER", "?")
        print(f"  Q{i}: {q.get('QUESTION', '—')[:80]}  [Answer: {correct}]")

    cr = parsed.get("creative_response", {})
    _print_section("CREATIVE RESPONSE PROMPT", cr.get("PROMPT", "MISSING"))
    for h in ["HINT_1", "HINT_2", "HINT_3"]:
        print(f"  Hint: {cr.get(h, '—')[:100]}")

    events = parsed.get("timeline_events", [])
    filled_ev = [e for e in events if e]
    print(f"\n{'─' * 60}")
    print(f"  TIMELINE EVENTS ({len(filled_ev)} / 7 events)")
    print(f"{'─' * 60}")
    for i, ev in enumerate(events, 1):
        print(f"  {i}. {ev[:100]}")

    _print_section("PREDICTION SETUP", parsed.get("prediction_setup", "MISSING"))


def main() -> None:
    if not _check_api_key():
        sys.exit(1)

    print(f"\nLoading sample JSON from: {SAMPLE_JSON}")
    with open(SAMPLE_JSON) as f:
        chapter_json = json.load(f)

    grade = chapter_json.get("grade", 3)
    print(f"Book   : {chapter_json['book_title']} by {chapter_json['author']}")
    print(f"Chapter: {chapter_json['chapter_num']} — {chapter_json['chapter_title']}")
    print(f"Grade  : {grade}")
    print(f"Pages  : {chapter_json['page_range']}  ({len(chapter_json['pages'])} pages in sample)")
    print("\nCalling Claude API — this may take 30–90 seconds…")

    try:
        docx_buf = generate_student_workbook(chapter_json, grade=grade)
    except GeneratorError as exc:
        print(f"\n✗ GeneratorError: {exc}")
        sys.exit(1)

    # Save the .docx
    with open(OUTPUT_DOCX, "wb") as f:
        f.write(docx_buf.read())
    print(f"\n✓ Word doc saved to: {OUTPUT_DOCX}")

    # Also print a text summary by re-parsing (generator already parsed internally,
    # but we re-parse from the saved file to verify round-trip — skipped here;
    # we just confirm the file exists and is non-empty).
    size_kb = os.path.getsize(OUTPUT_DOCX) / 1024
    print(f"  File size: {size_kb:.1f} KB")
    print("\nDone. Open the .docx file to review the full workbook.")


if __name__ == "__main__":
    main()
