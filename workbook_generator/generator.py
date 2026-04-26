"""Main orchestrator for the Student Workbook Generator."""

import io
import logging
import os
import tempfile
from typing import Any, Dict, Optional

import anthropic

from workbook_generator.doc_builder import build_docx
from workbook_generator.prompts import build_system_prompt, build_user_prompt
from workbook_generator.response_parser import parse_workbook_response
from workbook_generator.vocab_enricher import enrich_selected_vocab_words
from workbook_generator.vocab_selector import select_vocab_words

logger = logging.getLogger(__name__)

MODEL = os.environ.get("CB4A_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8192


class GeneratorError(Exception):
    """Raised for expected failures: bad input, API errors, parse failures."""


def _validate_chapter_json(chapter_json: Dict[str, Any]) -> None:
    if not chapter_json.get("pages") and not chapter_json.get("full_text"):
        raise GeneratorError(
            "chapter_json must contain either 'pages' (list) or 'full_text' (str)."
        )


def _resolve_grade(chapter_json: Dict[str, Any], grade: Optional[int]) -> int:
    resolved = grade or chapter_json.get("grade")
    if resolved is None:
        raise GeneratorError(
            "Grade level is required. Pass 'grade' as a parameter or include it in the chapter JSON."
        )
    resolved = int(resolved)
    if not (3 <= resolved <= 8):
        raise GeneratorError(f"Grade must be between 3 and 8, got {resolved}.")
    return resolved


def _chapter_text(chapter_json: Dict[str, Any]) -> str:
    pages = chapter_json.get("pages", [])
    if pages:
        chunks = []
        for p in pages:
            text = (p.get("text") or "").strip()
            if not text:
                continue
            page_number = p.get("page_number", "")
            chunks.append(f"[PAGE {page_number}]\n{text}")
        return "\n\n---PAGE---\n\n".join(chunks)
    return (chapter_json.get("full_text") or "").strip()


def generate_student_workbook(
    chapter_json: Dict[str, Any],
    grade: Optional[int] = None,
) -> io.BytesIO:
    _validate_chapter_json(chapter_json)
    grade = _resolve_grade(chapter_json, grade)

    extracted_text = _chapter_text(chapter_json)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as tmp:
        tmp.write(extracted_text)
        text_path = tmp.name

    selected_vocab_words = []
    try:
        selected_words = select_vocab_words(text_path, grade)
        selected_vocab_words = enrich_selected_vocab_words(selected_words, extracted_text, grade)
    finally:
        try:
            os.unlink(text_path)
        except OSError:
            pass

    system_prompt = build_system_prompt(chapter_json, grade, selected_vocab_words)
    user_prompt = build_user_prompt(grade, chapter_json, selected_vocab_words)

    client = anthropic.Anthropic()
    logger.info("Calling Claude (%s) for grade %d workbook…", MODEL, grade)

    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            final = stream.get_final_message()

    except anthropic.AuthenticationError:
        raise GeneratorError(
            "Anthropic API key is missing or invalid. Set the ANTHROPIC_API_KEY environment variable."
        )
    except anthropic.BadRequestError as exc:
        raise GeneratorError(f"Claude rejected the request: {exc}") from exc
    except anthropic.APIConnectionError as exc:
        raise GeneratorError(f"Could not reach the Anthropic API: {exc}") from exc
    except anthropic.APIStatusError as exc:
        raise GeneratorError(f"Anthropic API error {exc.status_code}: {exc.message}") from exc

    usage = final.usage
    logger.info(
        "Token usage — input: %d, cached: %d, output: %d",
        usage.input_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
        usage.output_tokens,
    )

    raw_text = ""
    for block in final.content:
        if block.type == "text":
            raw_text = block.text
            break

    if not raw_text:
        raise GeneratorError("Claude returned an empty response.")

    parsed = parse_workbook_response(raw_text)
    if not parsed.get("focus_question"):
        logger.warning("Focus question section is empty in parsed response.")
    if not any(v.get("WORD") for v in parsed.get("vocabulary", [])):
        logger.warning("Vocabulary section appears empty in parsed response.")

    docx_buf = build_docx(parsed, chapter_json, grade)
    return docx_buf
