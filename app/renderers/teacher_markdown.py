"""Deterministic teacher-guide markdown renderer."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.models.lesson_schema import RenderedTeacherGuide


_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"
_ENV = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
    undefined=StrictUndefined,
)


def render_teacher_markdown(teacher: RenderedTeacherGuide) -> str:
    template = _ENV.get_template("teacher_guide.md.j2")
    return template.render(sections=teacher.sections).strip() + "\n"
