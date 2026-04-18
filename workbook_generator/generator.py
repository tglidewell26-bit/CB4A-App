"""
Main orchestrator for the Student Workbook Generator.

Flow:
  1. Build system prompt (chapter text + rules) — marked cacheable so the
     large chapter text is served from Anthropic's prompt cache on repeat calls.
  2. Build user prompt (grade-specific instructions + output format spec).
  3. Call Claude (claude-sonnet-4-6, adaptive thinking, streaming).
  4. Parse the XML-tagged response.
  5. Build and return a .docx BytesIO.
"""

import io
import logging
import os
from typing import Any, Dict, Optional

import anthropic

from workbook_generator.doc_builder import build_docx
from workbook_generator.prompts import build_system_prompt, build_user_prompt
from workbook_generator.response_parser import parse_workbook_response

logger = logging.getLogger(__name__)

MODEL = os.environ.get("CB4A_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8192


class GeneratorError(Exception):
    """Raised for expected failures: bad input, API errors, parse failures."""


def _validate_chapter_json(chapter_json: Dict[str, Any]) -> None:
    """Raise GeneratorError if the chapter JSON is missing critical fields."""
    if not chapter_json.get("pages") and not chapter_json.get("full_text"):
        raise GeneratorError(
            "chapter_json must contain either 'pages' (list) or 'full_text' (str)."
        )


def _resolve_grade(chapter_json: Dict[str, Any], grade: Optional[int]) -> int:
    resolved = grade or chapter_json.get("grade")
    if resolved is None:
        raise GeneratorError(
            "Grade level is required. Pass 'grade' as a parameter or include "
            "it in the chapter JSON."
        )
    resolved = int(resolved)
    if not (3 <= resolved <= 8):
        raise GeneratorError(f"Grade must be between 3 and 8, got {resolved}.")
    return resolved


def generate_student_workbook(
    chapter_json: Dict[str, Any],
    grade: Optional[int] = None,
) -> io.BytesIO:
    """
    Generate a Student Workbook .docx from a parsed chapter JSON.

    Args:
        chapter_json: Output from the Document Parser module (Module 2).
                      Must contain 'pages' or 'full_text'.
                      May contain 'grade', 'book_title', 'author', etc.
        grade:        Grade level 3-8.  If None, falls back to chapter_json['grade'].

    Returns:
        BytesIO positioned at 0, containing the generated .docx file.

    Raises:
        GeneratorError: For invalid input, API failures, or parse failures.
    """
    _validate_chapter_json(chapter_json)
    grade = _resolve_grade(chapter_json, grade)

    system_prompt = build_system_prompt(chapter_json, grade)
    user_prompt = build_user_prompt(grade, chapter_json)

    client = anthropic.Anthropic()

    logger.info("Calling Claude (%s) for grade %d workbook…", MODEL, grade)

    try:
        # Stream the response to avoid HTTP timeout on long generations.
        # Cache the system prompt (chapter text) — on repeated calls for the
        # same chapter the large token block is served from cache at ~10% cost.
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
            "Anthropic API key is missing or invalid. "
            "Set the ANTHROPIC_API_KEY environment variable."
        )
    except anthropic.BadRequestError as exc:
        raise GeneratorError(f"Claude rejected the request: {exc}") from exc
    except anthropic.APIConnectionError as exc:
        raise GeneratorError(f"Could not reach the Anthropic API: {exc}") from exc
    except anthropic.APIStatusError as exc:
        raise GeneratorError(
            f"Anthropic API error {exc.status_code}: {exc.message}"
        ) from exc

    # Log cache efficiency for monitoring
    usage = final.usage
    logger.info(
        "Token usage — input: %d, cached: %d, output: %d",
        usage.input_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
        usage.output_tokens,
    )

    # Extract text from the response (skip thinking blocks)
    raw_text = ""
    for block in final.content:
        if block.type == "text":
            raw_text = block.text
            break

    if not raw_text:
        raise GeneratorError("Claude returned an empty response.")

    logger.debug("Raw Claude response (first 500 chars): %s", raw_text[:500])

    parsed = parse_workbook_response(raw_text)

    # Warn if critical sections are empty (don't hard-fail — partial is better
    # than nothing for the user).
    if not parsed.get("focus_question"):
        logger.warning("Focus question section is empty in parsed response.")
    if not any(v.get("WORD") for v in parsed.get("vocabulary", [])):
        logger.warning("Vocabulary section appears empty in parsed response.")

    docx_buf = build_docx(parsed, chapter_json, grade)
    return docx_buf
