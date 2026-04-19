"""Canonical curriculum pipeline models.

These models define the single source-of-truth lesson object used to derive
both the student workbook and teacher guide.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


ID_PREFIXES = (
    "vocab_",
    "comp_",
    "inf_",
    "ana_",
    "mcq_",
    "short_",
    "creative_",
    "timeline_",
    "pred_",
)


class VocabularyItem(BaseModel):
    id: str
    term: str
    definition: str
    teaching_note: Optional[str] = None
    teacher_only: bool = False

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("vocab_"):
            raise ValueError("Vocabulary IDs must start with 'vocab_'.")
        return value


class QuestionBase(BaseModel):
    id: str
    prompt: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith(("comp_", "inf_", "ana_", "pred_")):
            raise ValueError("QuestionBase IDs must start with comp_/inf_/ana_/pred_.")
        return value


class MultipleChoiceQuestion(BaseModel):
    id: str
    prompt: str
    options: List[str]
    correct_option: int = Field(ge=0)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("mcq_"):
            raise ValueError("MCQ IDs must start with 'mcq_'.")
        return value

    @model_validator(mode="after")
    def validate_correct_option(self) -> "MultipleChoiceQuestion":
        if self.correct_option >= len(self.options):
            raise ValueError("correct_option must index into options list.")
        return self


class ShortAnswerQuestion(BaseModel):
    id: str
    prompt: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("short_"):
            raise ValueError("Short answer IDs must start with 'short_'.")
        return value


class CreativeResponse(BaseModel):
    id: str
    prompt: str
    hints: List[str]
    rubric_criteria: List[str]
    focus_keywords: List[str]
    teacher_notes: Optional[str] = None
    model_response: Optional[str] = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("creative_"):
            raise ValueError("Creative response IDs must start with 'creative_'.")
        return value


class TimelineEvent(BaseModel):
    id: str
    event_text: str
    order_index: int = Field(ge=1)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("timeline_"):
            raise ValueError("Timeline IDs must start with 'timeline_'.")
        return value


class TeacherSupport(BaseModel):
    item_id: str
    sample_answer: Optional[str] = None
    discussion_notes: Optional[str] = None
    rationale: Optional[str] = None
    correct_option: Optional[int] = None
    rubric: Optional[List[str]] = None
    teacher_guidance: Optional[str] = None
    ordered_event_ids: Optional[List[str]] = None


class LessonData(BaseModel):
    lesson_title: str
    before_you_read_question: str
    before_you_read_teacher_guidance: str
    vocabulary: List[VocabularyItem]
    comprehension_questions: List[QuestionBase]
    inference_questions: List[QuestionBase]
    analysis_questions: List[QuestionBase]
    multiple_choice: List[MultipleChoiceQuestion]
    short_answer: List[ShortAnswerQuestion]
    creative_response: CreativeResponse
    timeline: List[TimelineEvent]
    prediction: QuestionBase

    teacher_support_by_section: Dict[str, List[TeacherSupport]]
    teacher_vocabulary_ids: List[str]

    @model_validator(mode="after")
    def validate_ids_unique(self) -> "LessonData":
        ids: List[str] = []
        ids.extend(v.id for v in self.vocabulary)
        for field_name in (
            "comprehension_questions",
            "inference_questions",
            "analysis_questions",
            "multiple_choice",
            "short_answer",
            "timeline",
        ):
            ids.extend(getattr(self, field_name)[i].id for i in range(len(getattr(self, field_name))))
        ids.append(self.creative_response.id)
        ids.append(self.prediction.id)
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate IDs found in lesson data.")
        for item_id in ids:
            if not item_id.startswith(ID_PREFIXES):
                raise ValueError(f"Unsupported ID prefix: {item_id}")
        return self


class RenderedWorkbook(BaseModel):
    sections: Dict[str, Any]
    source_item_ids: List[str]
    markdown: Optional[str] = None


class RenderedTeacherGuide(BaseModel):
    sections: Dict[str, Any]
    source_item_ids: List[str]
    markdown: Optional[str] = None


class AlignmentReport(BaseModel):
    passed: bool
    errors: List[str]
    warnings: List[str] = []
