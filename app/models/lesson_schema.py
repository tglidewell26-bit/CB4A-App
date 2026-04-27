"""Canonical lesson schema used by both workbook and teacher-guide derivation."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


SectionName = Literal[
    "before_you_read",
    "vocabulary",
    "comprehension_questions",
    "inference_questions",
    "analysis_questions",
    "multiple_choice",
    "short_answer",
    "creative_response",
    "timeline",
    "prediction",
]


class VocabularyItem(BaseModel):
    id: str
    term: str
    definition: str
    teacher_only: bool = False
    teaching_note: Optional[str] = None

    @field_validator("id")
    @classmethod
    def id_prefix(cls, value: str) -> str:
        if not value.startswith("vocab_"):
            raise ValueError("Vocabulary ID must start with vocab_.")
        return value


class QuestionBase(BaseModel):
    id: str
    prompt: str

    @field_validator("id")
    @classmethod
    def has_known_prefix(cls, value: str) -> str:
        if not value.startswith(("comp_", "inf_", "ana_", "pred_", "short_")):
            raise ValueError("Invalid question ID prefix.")
        return value


class MultipleChoiceQuestion(BaseModel):
    id: str
    prompt: str
    options: List[str] = Field(min_length=2)
    correct_option: int = Field(ge=0)

    @field_validator("id")
    @classmethod
    def id_prefix(cls, value: str) -> str:
        if not value.startswith("mcq_"):
            raise ValueError("MCQ ID must start with mcq_.")
        return value

    @model_validator(mode="after")
    def valid_correct_option(self) -> "MultipleChoiceQuestion":
        if self.correct_option >= len(self.options):
            raise ValueError("correct_option must reference an existing option.")
        return self


class ShortAnswerQuestion(BaseModel):
    id: str
    prompt: str

    @field_validator("id")
    @classmethod
    def id_prefix(cls, value: str) -> str:
        if not value.startswith("short_"):
            raise ValueError("Short answer ID must start with short_.")
        return value


class CreativeResponse(BaseModel):
    id: str
    prompt: str
    hints: List[str] = Field(default_factory=list)
    rubric_criteria: List[str] = Field(min_length=1)
    focus_keywords: List[str] = Field(min_length=1)

    @field_validator("id")
    @classmethod
    def id_prefix(cls, value: str) -> str:
        if not value.startswith("creative_"):
            raise ValueError("Creative response ID must start with creative_.")
        return value


class TimelineEvent(BaseModel):
    id: str
    event_text: str
    order_index: int = Field(ge=1)

    @field_validator("id")
    @classmethod
    def id_prefix(cls, value: str) -> str:
        if not value.startswith("timeline_"):
            raise ValueError("Timeline event ID must start with timeline_.")
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
    prompt_id: Optional[str] = None


class LessonData(BaseModel):
    lesson_title: str
    before_you_read_question: str
    before_you_read_teacher_guidance: str

    vocabulary: List[VocabularyItem] = Field(default_factory=list)
    comprehension_questions: List[QuestionBase] = Field(default_factory=list)
    inference_questions: List[QuestionBase] = Field(default_factory=list)
    analysis_questions: List[QuestionBase] = Field(default_factory=list)
    multiple_choice: List[MultipleChoiceQuestion] = Field(default_factory=list)
    short_answer: List[ShortAnswerQuestion] = Field(default_factory=list)
    creative_response: CreativeResponse
    timeline: List[TimelineEvent] = Field(default_factory=list)
    prediction: QuestionBase

    teacher_support_by_section: Dict[SectionName, List[TeacherSupport]]
    teacher_vocabulary_ids: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_no_duplicate_ids(self) -> "LessonData":
        all_ids: List[str] = []
        all_ids.extend(v.id for v in self.vocabulary)
        all_ids.extend(q.id for q in self.comprehension_questions)
        all_ids.extend(q.id for q in self.inference_questions)
        all_ids.extend(q.id for q in self.analysis_questions)
        all_ids.extend(q.id for q in self.multiple_choice)
        all_ids.extend(q.id for q in self.short_answer)
        all_ids.extend(e.id for e in self.timeline)
        all_ids.append(self.creative_response.id)
        all_ids.append(self.prediction.id)
        if len(set(all_ids)) != len(all_ids):
            raise ValueError("Duplicate content IDs are not allowed.")
        return self


class RenderedWorkbook(BaseModel):
    sections: Dict[SectionName, object]
    markdown: str = ""


class RenderedTeacherGuide(BaseModel):
    sections: Dict[SectionName, object]
    markdown: str = ""


class AlignmentReport(BaseModel):
    passed: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    coverage_by_section: Dict[str, float] = Field(default_factory=dict)
