"""Normalize raw extraction into canonical LessonData."""

from __future__ import annotations

from typing import Any, Dict, List

from app.models.extraction_schema import RawLessonExtraction
from app.models.lesson_schema import (
    CreativeResponse,
    LessonData,
    MultipleChoiceQuestion,
    QuestionBase,
    SectionName,
    ShortAnswerQuestion,
    TeacherSupport,
    TimelineEvent,
    VocabularyItem,
)
from app.services.id_factory import make_id


REQUIRED_SUPPORT_SECTIONS: List[SectionName] = [
    "comprehension_questions",
    "inference_questions",
    "analysis_questions",
    "multiple_choice",
    "short_answer",
    "creative_response",
    "timeline",
    "prediction",
]


def normalize_lesson(raw_payload: Dict[str, Any]) -> LessonData:
    raw = RawLessonExtraction.model_validate(raw_payload)

    vocabulary = [
        VocabularyItem(
            id=make_id("vocab", i),
            term=item.get("term", "").strip(),
            definition=item.get("definition", "").strip(),
            teacher_only=bool(item.get("teacher_only", False)),
            teaching_note=item.get("teaching_note"),
        )
        for i, item in enumerate(raw.vocabulary_candidates, start=1)
        if item.get("term") and item.get("definition")
    ]

    comp = _mk_questions(raw.comprehension_candidates, "comp")
    inf = _mk_questions(raw.inference_candidates, "inf")
    ana = _mk_questions(raw.analysis_candidates, "ana")
    short = [
        ShortAnswerQuestion(id=make_id("short", i), prompt=item.get("prompt", "").strip())
        for i, item in enumerate(raw.short_answer_candidates, start=1)
        if item.get("prompt")
    ]
    mcq = _mk_mcq(raw.multiple_choice_candidates)

    timeline = [
        TimelineEvent(
            id=make_id("timeline", i),
            event_text=event.get("event_text", event.get("text", "")).strip(),
            order_index=i,
        )
        for i, event in enumerate(raw.plot_events, start=1)
        if event.get("event_text") or event.get("text")
    ]

    creative_raw = raw.creative_response_candidate or {}
    creative = CreativeResponse(
        id="creative_001",
        prompt=creative_raw.get("prompt", "Write a paragraph response using chapter evidence."),
        hints=creative_raw.get("hints", []),
        rubric_criteria=creative_raw.get("rubric_criteria", ["Uses evidence"]),
        focus_keywords=creative_raw.get("focus_keywords", ["evidence"]),
    )

    pred_raw = raw.prediction_candidate or {}
    prediction = QuestionBase(
        id="pred_001",
        prompt=pred_raw.get("prompt", "Predict what might happen next and explain your reasoning."),
    )

    supports: Dict[SectionName, List[TeacherSupport]] = {
        "before_you_read": [],
        "vocabulary": [],
        "comprehension_questions": [TeacherSupport(item_id=q.id) for q in comp],
        "inference_questions": [TeacherSupport(item_id=q.id) for q in inf],
        "analysis_questions": [TeacherSupport(item_id=q.id) for q in ana],
        "multiple_choice": [TeacherSupport(item_id=q.id, correct_option=q.correct_option) for q in mcq],
        "short_answer": [TeacherSupport(item_id=q.id) for q in short],
        "creative_response": [TeacherSupport(item_id=creative.id, prompt_id=creative.id, rubric=creative.rubric_criteria)],
        "timeline": [TeacherSupport(item_id=e.id, ordered_event_ids=[x.id for x in timeline]) for e in timeline],
        "prediction": [TeacherSupport(item_id=prediction.id)],
    }

    return LessonData(
        lesson_title=raw.chapter_title,
        before_you_read_question=f"How does the opening of '{raw.chapter_title}' set the scene?",
        before_you_read_teacher_guidance="Ask students to cite setting details before sharing answers.",
        vocabulary=vocabulary,
        comprehension_questions=comp,
        inference_questions=inf,
        analysis_questions=ana,
        multiple_choice=mcq,
        short_answer=short,
        creative_response=creative,
        timeline=timeline,
        prediction=prediction,
        teacher_support_by_section=supports,
        teacher_vocabulary_ids=[v.id for v in vocabulary if not v.teacher_only],
    )


def _mk_questions(candidates: List[Dict[str, Any]], prefix: str) -> List[QuestionBase]:
    result: List[QuestionBase] = []
    for i, item in enumerate(candidates, start=1):
        prompt = item.get("prompt", "").strip()
        if prompt:
            result.append(QuestionBase(id=make_id(prefix, i), prompt=prompt))
    return result


def _mk_mcq(candidates: List[Dict[str, Any]]) -> List[MultipleChoiceQuestion]:
    out: List[MultipleChoiceQuestion] = []
    for i, item in enumerate(candidates, start=1):
        prompt = item.get("prompt", "").strip()
        options = [str(o).strip() for o in item.get("options", []) if str(o).strip()]
        if not prompt or len(options) < 2:
            continue
        out.append(
            MultipleChoiceQuestion(
                id=make_id("mcq", i),
                prompt=prompt,
                options=options,
                correct_option=int(item.get("correct_option", 0)),
            )
        )
    return out
