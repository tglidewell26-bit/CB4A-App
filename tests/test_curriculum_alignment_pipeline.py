import json
import unittest
from copy import deepcopy
from pathlib import Path

from curriculum_pipeline.derivation import derive_sections
from curriculum_pipeline.normalization import normalize_to_lesson_data
from curriculum_pipeline.pipeline import generate_aligned_outputs
from curriculum_pipeline.renderer import render_teacher_markdown, render_workbook_markdown
from curriculum_pipeline.validation import AlignmentError, validate_alignment


FIXTURE_DIR = Path("tests/fixtures/curriculum_pipeline")


class TestCurriculumAlignmentPipeline(unittest.TestCase):
    def setUp(self):
        with (FIXTURE_DIR / "lesson_excerpt_raw.json").open("r", encoding="utf-8") as f:
            self.raw = json.load(f)

    def _lesson(self):
        return normalize_to_lesson_data(deepcopy(self.raw))

    def test_perfect_alignment_pass(self):
        lesson = self._lesson()
        workbook, teacher = derive_sections(lesson)
        report = validate_alignment(lesson, workbook, teacher)
        self.assertTrue(report.passed)

    def test_workbook_vocab_missing_from_teacher_fails(self):
        lesson = self._lesson()
        lesson.teacher_vocabulary_ids = ["vocab_001"]
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_teacher_extra_vocab_not_in_workbook_fails(self):
        lesson = self._lesson()
        workbook, teacher = derive_sections(lesson)
        teacher.sections["vocabulary"].append({"id": "vocab_999", "term": "invented", "definition": "x", "teacher_only": False})
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_workbook_question_missing_teacher_answer_fails(self):
        lesson = self._lesson()
        lesson.teacher_support_by_section["comprehension_questions"] = []
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_teacher_answer_wrong_question_id_fails(self):
        lesson = self._lesson()
        lesson.teacher_support_by_section["inference_questions"][0].item_id = "inf_999"
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_mcq_rationale_wrong_correct_option_fails(self):
        lesson = self._lesson()
        lesson.teacher_support_by_section["multiple_choice"][0].correct_option = 0
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_timeline_order_mismatch_fails(self):
        lesson = self._lesson()
        lesson.teacher_support_by_section["timeline"][0].ordered_event_ids = ["timeline_002", "timeline_001", "timeline_003"]
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_creative_rubric_prompt_focus_mismatch_fails(self):
        lesson = self._lesson()
        lesson.teacher_support_by_section["creative_response"][0].rubric = ["Uses grammar", "Has organization"]
        workbook, teacher = derive_sections(lesson)
        with self.assertRaises(AlignmentError):
            validate_alignment(lesson, workbook, teacher)

    def test_workbook_markdown_snapshot(self):
        workbook, teacher, report = generate_aligned_outputs(deepcopy(self.raw))
        self.assertTrue(report.passed)
        expected = (FIXTURE_DIR / "expected_workbook.md").read_text(encoding="utf-8")
        self.assertEqual(workbook.markdown, expected)

    def test_teacher_markdown_snapshot(self):
        workbook, teacher, report = generate_aligned_outputs(deepcopy(self.raw))
        self.assertTrue(report.passed)
        expected = (FIXTURE_DIR / "expected_teacher.md").read_text(encoding="utf-8")
        self.assertEqual(teacher.markdown, expected)


if __name__ == "__main__":
    unittest.main()
