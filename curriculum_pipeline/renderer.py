"""Deterministic markdown renderers for workbook and teacher guide."""

from __future__ import annotations

from curriculum_pipeline.models import RenderedTeacherGuide, RenderedWorkbook


def render_workbook_markdown(workbook: RenderedWorkbook) -> str:
    s = workbook.sections
    lines = ["# Student Workbook", "", "## Before You Read", s["before_you_read"]["focus_question"], ""]

    lines.append("## Vocabulary")
    for v in s["vocabulary"]:
        lines.append(f"- **{v['id']}** {v['term']}: {v['definition']}")
    lines.append("")

    _render_questions(lines, "Comprehension Questions", s["comprehension_questions"])
    _render_questions(lines, "Inference Questions", s["inference_questions"])
    _render_questions(lines, "Analysis Questions", s["analysis_questions"])

    lines.append("## Multiple Choice")
    for q in s["multiple_choice"]:
        lines.append(f"- **{q['id']}** {q['prompt']}")
        for idx, option in enumerate(q["options"]):
            lines.append(f"  - ({idx}) {option}")
    lines.append("")

    _render_questions(lines, "Short Answer", s["short_answer"])

    creative = s["creative_response"]
    lines.extend([
        "## Creative Response",
        f"- **{creative['id']}** {creative['prompt']}",
        "- Hints:",
    ])
    lines.extend([f"  - {hint}" for hint in creative["hints"]])
    lines.append("")

    lines.append("## Timeline")
    for event in s["timeline"]:
        lines.append(f"- **{event['id']}** ({event['order_index']}) {event['event_text']}")
    lines.append("")

    pred = s["prediction"]
    lines.extend(["## Prediction", f"- **{pred['id']}** {pred['prompt']}", ""])
    return "\n".join(lines).strip() + "\n"


def render_teacher_markdown(teacher: RenderedTeacherGuide) -> str:
    s = teacher.sections
    lines = ["# Teacher Guide", "", "## Before You Read", s["before_you_read"]["launch_guidance"], ""]

    lines.append("## Vocabulary")
    for v in s["vocabulary"]:
        note = v.get("teaching_note") or ""
        lines.append(f"- **{v['id']}** {v['term']}: {v['definition']} ({note})")
    lines.append("")

    _render_support(lines, "Comprehension Support", s["comprehension_questions"])
    _render_support(lines, "Inference Support", s["inference_questions"])
    _render_support(lines, "Analysis Support", s["analysis_questions"])

    lines.append("## Multiple Choice Support")
    for item in s["multiple_choice"]:
        lines.append(
            f"- **{item['item_id']}** correct_option={item.get('correct_option')} rationale={item.get('rationale','')}"
        )
    lines.append("")

    _render_support(lines, "Short Answer Support", s["short_answer"])

    lines.append("## Creative Response Support")
    for item in s["creative_response"]:
        lines.append(f"- **{item['item_id']}**")
        for criterion in item.get("rubric", []):
            lines.append(f"  - {criterion}")
        if item.get("teacher_guidance"):
            lines.append(f"  - guidance: {item['teacher_guidance']}")
    lines.append("")

    lines.append("## Timeline Support")
    for item in s["timeline"]:
        lines.append(f"- **{item['item_id']}** order={','.join(item.get('ordered_event_ids', []))}")
    lines.append("")

    lines.append("## Prediction Support")
    for item in s["prediction"]:
        lines.append(f"- **{item['item_id']}** {item.get('teacher_guidance','')}")
    lines.append("")

    return "\n".join(lines).strip() + "\n"


def _render_questions(lines: list[str], title: str, questions: list[dict]) -> None:
    lines.append(f"## {title}")
    for q in questions:
        lines.append(f"- **{q['id']}** {q['prompt']}")
    lines.append("")


def _render_support(lines: list[str], title: str, supports: list[dict]) -> None:
    lines.append(f"## {title}")
    for item in supports:
        lines.append(f"- **{item['item_id']}** {item.get('sample_answer','')}")
        if item.get("discussion_notes"):
            lines.append(f"  - notes: {item['discussion_notes']}")
    lines.append("")
