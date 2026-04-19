"""Raw extraction schema (AI-facing, potentially noisy)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RawLessonExtraction(BaseModel):
    chapter_title: str
    summary: str
    vocabulary_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    characters: List[Dict[str, Any]] = Field(default_factory=list)
    plot_events: List[Dict[str, Any]] = Field(default_factory=list)
    comprehension_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    inference_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    analysis_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    multiple_choice_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    short_answer_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    creative_response_candidate: Optional[Dict[str, Any]] = None
    prediction_candidate: Optional[Dict[str, Any]] = None
