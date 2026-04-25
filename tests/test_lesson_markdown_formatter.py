import unittest

from lesson_markdown_formatter import formatLessonToMarkdown


class TestLessonMarkdownFormatter(unittest.TestCase):
    def _build_valid_input(self):
        teacher_sections = [
            {"title": "Lesson Overview", "level": 2, "content": [{"type": "text", "text": "Overview text."}]},
            {"title": "Measurable Objectives", "level": 2, "content": [{"type": "ordered_list", "items": ["Objective 1 (RL.3.3)", "Objective 2"]}]},
            {"title": "Standards", "level": 2, "content": [{"type": "unordered_list", "items": ["(RL.3.3)", "(SL.3.1)"]}]},
            {"title": "Get Ready to Read", "level": 2, "content": [{"type": "text", "text": "Prompt ________________________________"}]},
            {"title": "Materials needed", "level": 2, "content": [{"type": "unordered_list", "items": ["Book", "Pencil"]}]},
            {"title": "Vocabulary sections", "level": 2, "content": [{"type": "table", "headers": ["Word", "Definition"], "rows": [["cozy", "warm"]]}]},
            {"title": "Guided Reading", "level": 2, "content": [{"type": "text", "text": "During reading"}]},
            {"title": "Differentiation sections", "level": 2, "content": [{"type": "unordered_list", "items": ["Struggling readers", "English language learners", "Advanced students"]}]},
            {"title": "Think About the Story", "level": 2, "content": [{"type": "text", "text": "Q1"}]},
            {"title": "Analytical Thinking", "level": 2, "content": [{"type": "text", "text": "Q2"}]},
            {"title": "Creative Response", "level": 2, "content": [{"type": "text", "text": "Draw it"}]},
            {"title": "Character Chart", "level": 2, "content": [{"type": "table", "headers": ["Character", "Trait"], "rows": [["Heidi", "Brave"]]}]},
            {"title": "Exit Ticket", "level": 2, "content": [{"type": "text", "text": "One sentence."}]},
            {"title": "Teacher notes", "level": 2, "content": [{"type": "blank_lines", "count": 2}]},
        ]

        student_sections = [
            {"title": "Get Ready to Read", "level": 2, "content": [{"type": "text", "text": "Think..."}]},
            {"title": "Words to Know", "level": 2, "content": [{"type": "table", "headers": ["Word", "Meaning"], "rows": [["steep", "high"]]}]},
            {"title": "Think About the Story", "level": 2, "content": [{"type": "ordered_list", "items": ["Q1", "Q2"]}]},
            {"title": "Reading Between the Lines", "level": 2, "content": [{"type": "text", "text": "Infer."}]},
            {"title": "Dig Deeper", "level": 2, "content": [{"type": "text", "text": "Analyze."}]},
            {"title": "Multiple Choice", "level": 2, "content": [{"type": "ordered_list", "items": ["A", "B"]}]},
            {"title": "Evidence from the Story", "level": 2, "content": [{"type": "text", "text": "because ________________________________."}]},
            {"title": "Creative Response", "level": 2, "content": [{"type": "text", "text": "Create."}]},
            {"title": "Writing Rubric (table)", "level": 2, "content": [{"type": "table", "headers": ["Criteria", "4"], "rows": [["Evidence", "Strong"]]}]},
            {"title": "Character Chart (table)", "level": 2, "content": [{"type": "table", "headers": ["Character", "Evidence"], "rows": [["Peter", "p. 5"]]}]},
            {"title": "Draw It", "level": 2, "content": [{"type": "text", "text": "Draw."}]},
            {"title": "Reflect on Drawing", "level": 2, "content": [{"type": "text", "text": "Reflect."}]},
            {"title": "Bonus Challenge - Follow the Story", "level": 2, "content": [{"type": "text", "text": "Bonus."}]},
            {"title": "Thinking Deeper", "level": 2, "content": [{"type": "text", "text": "Deeper."}]},
        ]

        return {"teacherGuide": {"sections": teacher_sections}, "studentWorkbook": {"sections": student_sections}}

    def test_formats_valid_input(self):
        data = self._build_valid_input()
        output = formatLessonToMarkdown(data)

        self.assertIn("# Teacher Guide", output)
        self.assertIn("# Student Workbook", output)
        self.assertIn("## Lesson Overview", output)
        self.assertIn("1. Objective 1 (RL.3.3)", output)
        self.assertIn("| Word | Definition |", output)
        self.assertIn("(RL.3.3)", output)

    def test_raises_on_missing_required_section(self):
        data = self._build_valid_input()
        data["teacherGuide"]["sections"] = data["teacherGuide"]["sections"][1:]
        with self.assertRaises(ValueError):
            formatLessonToMarkdown(data)


if __name__ == "__main__":
    unittest.main()
