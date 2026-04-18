import io
import logging
import os
from typing import Any, Dict, Optional

import anthropic

from teacher_generator.doc_builder import build_docx
from teacher_generator.prompts import build_system_prompt, build_user_prompt
from teacher_generator.response_parser import parse_teacher_response

logger = logging.getLogger(__name__)

MODEL = os.environ.get("CB4A_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 16000


class TeacherGeneratorError(Exception):
    pass


def _validate_chapter_json(chapter_json: Dict[str, Any]) -> None:
    if not chapter_json.get("pages") and not chapter_json.get("full_text"):
        raise TeacherGeneratorError(
            "chapter_json must contain either 'pages' (list) or 'full_text' (str)."
        )


def _resolve_grade(chapter_json: Dict[str, Any], grade: Optional[int]) -> int:
    resolved = grade or chapter_json.get("grade")
    if resolved is None:
        raise TeacherGeneratorError("Grade is required (3-8).")
    resolved = int(resolved)
    if not (3 <= resolved <= 8):
        raise TeacherGeneratorError(f"Grade must be between 3 and 8, got {resolved}.")
    return resolved


def generate_teacher_guide(
    chapter_json: Dict[str, Any],
    grade: Optional[int] = None,
    mock_response_text: Optional[str] = None,
) -> io.BytesIO:
    _validate_chapter_json(chapter_json)
    grade = _resolve_grade(chapter_json, grade)

    if mock_response_text is not None:
        parsed = parse_teacher_response(mock_response_text)
        return build_docx(parsed, chapter_json, grade)

    system_prompt = build_system_prompt(chapter_json, grade)
    user_prompt = build_user_prompt(chapter_json, grade)

    client = anthropic.Anthropic()
    logger.info("Calling Claude (%s) for Teacher Guide, grade %d", MODEL, grade)

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
        raise TeacherGeneratorError(
            "Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY."
        )
    except anthropic.BadRequestError as exc:
        raise TeacherGeneratorError(f"Claude rejected the request: {exc}") from exc
    except anthropic.APIConnectionError as exc:
        raise TeacherGeneratorError(f"Could not reach Anthropic API: {exc}") from exc
    except anthropic.APIStatusError as exc:
        raise TeacherGeneratorError(
            f"Anthropic API error {exc.status_code}: {exc.message}"
        ) from exc

    raw_text = ""
    for block in final.content:
        if block.type == "text":
            raw_text = block.text
            break

    if not raw_text:
        raise TeacherGeneratorError("Claude returned an empty response.")

    parsed = parse_teacher_response(raw_text)
    return build_docx(parsed, chapter_json, grade)
