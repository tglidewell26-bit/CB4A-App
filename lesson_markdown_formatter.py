"""Deterministic lesson markdown formatter.

This module only formats already-generated structured lesson content into Markdown.
It does not generate, rewrite, infer, or reorder content.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

MAJOR_SEPARATOR = "--------------------------------------------------"

TEACHER_REQUIRED_SECTIONS = (
    "Lesson Overview",
    "Measurable Objectives",
    "Standards",
    "Get Ready to Read",
    "Materials needed",
    "Vocabulary sections",
    "Guided Reading",
    "Differentiation sections",
    "Think About the Story",
    "Analytical Thinking",
    "Creative Response",
    "Character Chart",
    "Exit Ticket",
    "Teacher notes",
)

STUDENT_REQUIRED_SECTIONS = (
    "Get Ready to Read",
    "Words to Know table",
    "Think About the Story",
    "Reading Between the Lines",
    "Dig Deeper",
    "Multiple Choice Questions",
    "Evidence from the Story",
    "Creative Response",
    "Writing Rubric",
    "Character Chart",
    "Draw It",
    "Reflection",
    "Bonus Challenge",
    "Thinking Deeper",
)


@dataclass(frozen=True)
class _ValidationSnapshot:
    plain_text_segments: tuple[str, ...]
    parenthetical_segments: tuple[str, ...]


def formatLessonToMarkdown(inputData: dict[str, Any]) -> str:
    """Format structured lesson data into one Markdown string.

    Raises:
        ValueError: if required structure/sections are missing.
        RuntimeError: if post-render validation fails.
    """
    _validate_input_shape(inputData)
    _validate_required_sections(inputData)

    source_snapshot = _snapshot_source(inputData)

    output_parts: list[str] = []

    teacher = inputData["teacherGuide"]
    student = inputData["studentWorkbook"]

    output_parts.extend(_render_container("Teacher Guide", teacher))
    output_parts.append("")
    output_parts.append(MAJOR_SEPARATOR)
    output_parts.append("")
    output_parts.extend(_render_container("Student Workbook", student))

    markdown = "\n".join(output_parts).rstrip() + "\n"

    _validate_output(inputData, markdown, source_snapshot)
    return markdown


def _validate_input_shape(input_data: dict[str, Any]) -> None:
    if not isinstance(input_data, dict):
        raise ValueError("inputData must be an object/dict")

    for key in ("teacherGuide", "studentWorkbook"):
        if key not in input_data or not isinstance(input_data[key], dict):
            raise ValueError(f"Missing required object: {key}")
        sections = input_data[key].get("sections")
        if not isinstance(sections, list):
            raise ValueError(f"{key}.sections must be an array/list")


def _validate_required_sections(input_data: dict[str, Any]) -> None:
    teacher_titles = _section_titles(input_data["teacherGuide"]["sections"])
    student_titles = _section_titles(input_data["studentWorkbook"]["sections"])

    for required in TEACHER_REQUIRED_SECTIONS:
        if required not in teacher_titles:
            raise ValueError(f"Missing Teacher Guide section: {required}")

    for required in STUDENT_REQUIRED_SECTIONS:
        matched = required in student_titles or (
            required == "Writing Rubric" and "Writing Rubric (table)" in student_titles
        ) or (
            required == "Character Chart" and "Character Chart (table)" in student_titles
        )
        if not matched:
            raise ValueError(f"Missing Student Workbook section: {required}")


def _section_titles(sections: list[Any]) -> list[str]:
    titles: list[str] = []
    for section in sections:
        if isinstance(section, dict):
            title = section.get("title")
            if isinstance(title, str):
                titles.append(title)
    return titles


def _render_container(title: str, container: dict[str, Any]) -> list[str]:
    lines = [f"# {title}", ""]
    for idx, section in enumerate(container.get("sections", [])):
        lines.extend(_render_section(section))
        if idx < len(container["sections"]) - 1:
            lines.append("")
    return lines


def _render_section(section: Any) -> list[str]:
    if not isinstance(section, dict):
        return [str(section)]

    lines: list[str] = []
    title = section.get("title")
    level = section.get("level")

    if isinstance(title, str):
        heading_level = int(level) if isinstance(level, int) and 1 <= level <= 3 else 2
        lines.append(f"{'#' * heading_level} {title}")
        lines.append("")

    for block in section.get("content", []):
        lines.extend(_render_block(block))

    for child in section.get("sections", []):
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend(_render_section(child))

    while lines and lines[-1] == "":
        lines.pop()

    return lines


def _render_block(block: Any) -> list[str]:
    if isinstance(block, str):
        return [block, ""]

    if not isinstance(block, dict):
        return [str(block), ""]

    block_type = block.get("type")

    if block_type == "heading":
        text = _required_str(block, "text")
        level = block.get("level")
        heading_level = int(level) if isinstance(level, int) and 1 <= level <= 3 else 2
        return [f"{'#' * heading_level} {text}", ""]

    if block_type == "text":
        return [_required_str(block, "text"), ""]

    if block_type == "unordered_list":
        items = _required_list_of_strings(block, "items")
        return [*(f"- {item}" for item in items), ""]

    if block_type == "ordered_list":
        items = _required_list_of_strings(block, "items")
        return [*(f"{i}. {item}" for i, item in enumerate(items, 1)), ""]

    if block_type == "table":
        return _render_table_block(block)

    if block_type == "blank_lines":
        count = block.get("count", 1)
        if not isinstance(count, int) or count < 1:
            count = 1
        return ["" for _ in range(count)]

    # Generic deterministic fallback for known raw fields.
    if "text" in block and isinstance(block["text"], str):
        return [block["text"], ""]
    if "items" in block and isinstance(block["items"], list) and all(isinstance(i, str) for i in block["items"]):
        return [*(f"- {item}" for item in block["items"]), ""]

    raise ValueError(f"Unsupported content block shape: {block}")


def _render_table_block(block: dict[str, Any]) -> list[str]:
    headers = _required_list_of_strings(block, "headers")
    rows = block.get("rows")
    if not isinstance(rows, list):
        raise ValueError("table.rows must be a list")

    lines = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("--------" for _ in headers) + "|",
    ]

    for row in rows:
        if not isinstance(row, list) or len(row) != len(headers):
            raise ValueError("table row must be an array with same length as headers")
        if not all(isinstance(cell, str) for cell in row):
            raise ValueError("table cells must be strings")
        lines.append("| " + " | ".join(row) + " |")

    lines.append("")
    return lines


def _required_str(obj: dict[str, Any], field: str) -> str:
    value = obj.get(field)
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    return value


def _required_list_of_strings(obj: dict[str, Any], field: str) -> list[str]:
    value = obj.get(field)
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"{field} must be a list of strings")
    return value


def _snapshot_source(input_data: dict[str, Any]) -> _ValidationSnapshot:
    all_text = tuple(_collect_source_text(input_data))
    parenthetical = tuple(segment for segment in all_text if segment.startswith("(") and segment.endswith(")"))
    return _ValidationSnapshot(plain_text_segments=all_text, parenthetical_segments=parenthetical)


def _collect_source_text(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
        return

    if isinstance(value, list):
        for item in value:
            yield from _collect_source_text(item)
        return

    if isinstance(value, dict):
        # deterministic traversal order by insertion.
        for key, nested in value.items():
            if key == "type":
                continue
            yield from _collect_source_text(nested)


def _validate_output(input_data: dict[str, Any], markdown: str, snapshot: _ValidationSnapshot) -> None:
    # 1) Section order matches exactly (top-level titles).
    teacher_input_titles = _section_titles(input_data["teacherGuide"]["sections"])
    student_input_titles = _section_titles(input_data["studentWorkbook"]["sections"])

    teacher_output_titles = _extract_titles_from_markdown(markdown, teacher=True)
    student_output_titles = _extract_titles_from_markdown(markdown, teacher=False)

    if teacher_input_titles != teacher_output_titles:
        raise RuntimeError("Validation failed: Teacher Guide section order mismatch")
    if student_input_titles != student_output_titles:
        raise RuntimeError("Validation failed: Student Workbook section order mismatch")

    # 2) Every source string appears in output somewhere.
    for text in snapshot.plain_text_segments:
        if text and text not in markdown:
            raise RuntimeError(f"Validation failed: missing text segment: {text}")

    # 3) Parenthetical segments preserved exactly.
    for segment in snapshot.parenthetical_segments:
        if segment not in markdown:
            raise RuntimeError(f"Validation failed: parenthetical segment changed: {segment}")

    # 4) Tables remain tables (input table count must match markdown table header count).
    input_table_count = _count_tables(input_data)
    output_table_count = markdown.count("\n|--------")
    if input_table_count != output_table_count:
        raise RuntimeError("Validation failed: table count mismatch")


def _extract_titles_from_markdown(markdown: str, teacher: bool) -> list[str]:
    lines = markdown.splitlines()
    marker = "# Teacher Guide" if teacher else "# Student Workbook"
    other = "# Student Workbook" if teacher else None

    in_scope = False
    titles: list[str] = []
    for line in lines:
        if line == marker:
            in_scope = True
            continue
        if other and line == other:
            break
        if not in_scope:
            continue
        if line.startswith("## "):
            titles.append(line[3:])
    return titles


def _count_tables(value: Any) -> int:
    if isinstance(value, dict):
        own = 1 if value.get("type") == "table" else 0
        return own + sum(_count_tables(v) for v in value.values())
    if isinstance(value, list):
        return sum(_count_tables(item) for item in value)
    return 0
