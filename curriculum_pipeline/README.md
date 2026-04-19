# Curriculum Alignment Pipeline

This package adds a deterministic, alignment-enforced generation flow where the
Student Workbook and Teacher Guide are both derived from one canonical
`LessonData` object.

## Stages

1. **Source extraction** (`extraction.py`)
   - Input: chapter text
   - Output: structured JSON only
2. **Normalization** (`normalization.py`)
   - Converts extracted JSON to `LessonData` (Pydantic)
   - Deduplicates IDs
   - Rejects malformed / incomplete payloads
3. **Derivation** (`derivation.py`)
   - Builds workbook sections and teacher sections from the same `LessonData`
   - Teacher sections are mapping-based and ID-referenced
4. **Validation** (`validation.py`)
   - Enforces vocabulary equality (default)
   - Enforces 1:1 question/support coverage by section
   - Detects orphan workbook/teacher items
   - Validates MCQ correct option mappings
   - Validates timeline ordering against canonical sequence
   - Validates creative rubric alignment to prompt focus keywords
5. **Rendering** (`renderer.py`)
   - Deterministic markdown templates (no AI-controlled formatting)

## Invariants

- Every assessable workbook item has a stable ID (`comp_001`, `mcq_001`, etc.).
- Teacher support references only canonical workbook IDs.
- Teacher coverage is 100% for mapped required sections.
- Vocabulary term set must match exactly unless explicitly configured otherwise.
- Validation runs before markdown rendering in `pipeline.generate_aligned_outputs`.

## Running tests

```bash
python -m unittest tests/test_curriculum_alignment_pipeline.py
```
