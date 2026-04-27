"""Deterministic prefixed ID factory."""

from __future__ import annotations


def make_id(prefix: str, index: int) -> str:
    if index < 1:
        raise ValueError("index must be >= 1")
    return f"{prefix}_{index:03d}"
