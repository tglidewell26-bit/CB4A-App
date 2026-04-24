import json
import sys
from pathlib import Path

from workbook_generator.doc_builder import build_docx as build_workbook_docx
from teacher_generator.doc_builder import build_docx as build_teacher_docx


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("Missing payload", file=sys.stderr)
        return 2

    payload = json.loads(raw)
    template = payload.get("template")
    chapter_meta = payload.get("meta", {})
    grade = int(payload.get("grade", 5))
    vocabulary = payload.get("vocabulary", [])
    generated = payload.get("generated", {})
    output_path = Path(payload.get("outputPath"))

    chapter_json = {
        "book_title": chapter_meta.get("bookTitle", ""),
        "author": chapter_meta.get("author", ""),
        "chapter_num": chapter_meta.get("chapterNum", ""),
        "chapter_title": chapter_meta.get("chapterTitle", ""),
        "page_range": chapter_meta.get("pages", ""),
    }

    if template == "workbook":
        workbook_payload = dict(generated)
        workbook_payload["vocabulary"] = [
            {
                "WORD": item.get("word", ""),
                "BOOK_QUOTE": item.get("book_quote", ""),
                "DEFINITION": item.get("kid_friendly_definition", ""),
                "EXAMPLE_SENTENCE": item.get("example_sentence", ""),
            }
            for item in vocabulary
        ]
        buf = build_workbook_docx(workbook_payload, chapter_json, grade)
    elif template == "teacher":
        teacher_payload = dict(generated)
        teacher_payload["vocabulary"] = [
            {
                "WORD": item.get("word", ""),
                "PAGE": item.get("page_number", ""),
                "KID_FRIENDLY_DEFINITION": item.get("kid_friendly_definition", ""),
                "CONTEXT_SENTENCE": item.get("context_sentence", ""),
                "EXAMPLE_SENTENCE": item.get("example_sentence", ""),
            }
            for item in vocabulary
        ]
        buf = build_teacher_docx(teacher_payload, chapter_json, grade)
    else:
        print(f"Unknown template: {template}", file=sys.stderr)
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(buf.getvalue())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
