"""
Prompt construction for the Student Workbook Generator.

Design notes:
- Chapter text (large, stable) goes in the system prompt with cache_control so
  repeated calls for the same chapter don't re-pay full input token cost.
- Grade-specific instructions + the output format spec go in the user turn,
  which varies per request and is not cached.
- Page markers ([PAGE N]) embedded in the chapter text let Claude cite accurate
  page numbers in every BOOK_QUOTE field.
"""

from typing import Any, Dict

# Per-grade guidance injected into both the system prompt and the output
# instructions so the model calibrates complexity throughout.
GRADE_GUIDANCE: Dict[int, str] = {
    3: (
        "Grade 3 (ages 8-9): Very simple vocabulary and short sentences. "
        "Comprehension questions are literal — the answer can be pointed to in "
        "a single sentence. Vocabulary definitions use only words a 3rd grader "
        "already knows. Creative prompt has heavy scaffolding."
    ),
    4: (
        "Grade 4 (ages 9-10): Clear, accessible language. Mix of literal and "
        "one or two simple inference questions. Definitions friendly and brief."
    ),
    5: (
        "Grade 5 (ages 10-11): Grade-appropriate language. Mix of literal and "
        "inferential questions. Students support answers with text evidence."
    ),
    6: (
        "Grade 6 (ages 11-12): More sophisticated language. Inference and basic "
        "analysis questions dominate. Vocabulary genuinely challenging. Text "
        "evidence required."
    ),
    7: (
        "Grade 7 (ages 12-13): Literary and analytical language. Character "
        "motivation, theme, author craft. Advanced vocabulary. Strong text "
        "evidence with page citations."
    ),
    8: (
        "Grade 8 (ages 13-14): Sophisticated literary analysis. Literary "
        "devices, thematic depth, in-depth character analysis. Challenging "
        "vocabulary with nuanced definitions. Direct quotation as evidence."
    ),
}

# Output format the model must follow exactly.  Each tag name is used verbatim
# by response_parser.py — keep them in sync if you change anything here.
_OUTPUT_FORMAT = """\
Produce your entire response inside a single <WORKBOOK> block using this exact
XML structure.  Do not add extra commentary, summaries, or text outside the
<WORKBOOK> tags.

<WORKBOOK>

<FOCUS_QUESTION>
[One engaging before-reading question, grade-appropriate language]
</FOCUS_QUESTION>

<VOCABULARY>
<VOCAB_1>
<WORD>[word]</WORD>
<BOOK_QUOTE>"[exact verbatim quote from the chapter text]" (p. [N])</BOOK_QUOTE>
<DEFINITION>[grade-appropriate definition]</DEFINITION>
<EXAMPLE_SENTENCE>[original example sentence]</EXAMPLE_SENTENCE>
</VOCAB_1>
<VOCAB_2> ... </VOCAB_2>
[continue through VOCAB_10]
</VOCABULARY>

<BASIC_COMPREHENSION>
<BC_1>
<QUESTION>[question whose answer is stated directly in the text]</QUESTION>
<ANSWER>[answer with page reference, e.g. "About five years old (p. 1)"]</ANSWER>
</BC_1>
[continue through BC_6]
</BASIC_COMPREHENSION>

<INFERENCE_QUESTIONS>
<IQ_1>
<QUESTION>[question requiring reading between the lines]</QUESTION>
<ANSWER>[expected answer grounded in the text]</ANSWER>
</IQ_1>
[continue through IQ_3]
</INFERENCE_QUESTIONS>

<ANALYSIS_QUESTIONS>
<AQ_1>
<QUESTION>[deeper question about character, theme, or craft]</QUESTION>
<ANSWER>[expected answer with text support]</ANSWER>
</AQ_1>
[continue through AQ_3]
</ANALYSIS_QUESTIONS>

<MULTIPLE_CHOICE>
<MC_1>
<QUESTION>[question]</QUESTION>
<OPTION_A>[option A]</OPTION_A>
<OPTION_B>[option B]</OPTION_B>
<OPTION_C>[option C]</OPTION_C>
<OPTION_D>[option D]</OPTION_D>
<CORRECT_ANSWER>[A, B, C, or D]</CORRECT_ANSWER>
</MC_1>
[continue through MC_3]
</MULTIPLE_CHOICE>

<SHORT_ANSWER>
<SA_1>
<QUESTION>[question requiring a text-evidence answer with page number]</QUESTION>
<ANSWER>[expected answer with page evidence]</ANSWER>
</SA_1>
[continue through SA_3]
</SHORT_ANSWER>

<CREATIVE_RESPONSE>
<PROMPT>[writing prompt appropriate to the chapter and grade]</PROMPT>
<HINT_1>[scaffolding hint 1]</HINT_1>
<HINT_2>[scaffolding hint 2]</HINT_2>
<HINT_3>[scaffolding hint 3]</HINT_3>
</CREATIVE_RESPONSE>

<TIMELINE_EVENTS>
<EVENT_1>[first key event in correct chronological order]</EVENT_1>
<EVENT_2>[second event]</EVENT_2>
<EVENT_3>[third event]</EVENT_3>
<EVENT_4>[fourth event]</EVENT_4>
<EVENT_5>[fifth event]</EVENT_5>
<EVENT_6>[sixth event]</EVENT_6>
<EVENT_7>[seventh event]</EVENT_7>
</TIMELINE_EVENTS>

<PREDICTION_SETUP>
[One sentence stem for a "Thinking Deeper" prediction activity, e.g.
"Based on what happened in this chapter, I predict that..."]
</PREDICTION_SETUP>

</WORKBOOK>"""


def build_system_prompt(chapter_json: Dict[str, Any], grade: int) -> str:
    """
    Build the (cacheable) system prompt that includes the full chapter text.

    The chapter text is formatted with [PAGE N] markers before each page so
    Claude can cite accurate page numbers in every BOOK_QUOTE field.
    """
    guidance = GRADE_GUIDANCE.get(grade, GRADE_GUIDANCE[5])

    pages = chapter_json.get("pages", [])
    if pages:
        page_blocks = []
        for p in pages:
            text = (p.get("text") or "").strip()
            if text:
                page_blocks.append(f"[PAGE {p['page_number']}]\n{text}")
        chapter_text = "\n\n".join(page_blocks)
    else:
        chapter_text = chapter_json.get("full_text", "").strip()

    book_title = chapter_json.get("book_title", "Unknown Title")
    author = chapter_json.get("author", "Unknown Author")
    chapter_num = chapter_json.get("chapter_num", "")
    chapter_title = chapter_json.get("chapter_title", "")

    return f"""\
You are a curriculum specialist for Classic Books for All (CB4A), creating \
Student Workbook content for young readers in grades 3–8.

══ CRITICAL RULES — FOLLOW EXACTLY ══
1. Use ONLY the chapter text provided below. Never use outside knowledge,
   internet sources, or facts not present in this text.
2. Every BOOK_QUOTE must be an exact word-for-word quotation from the chapter
   text, followed by the correct page number in the format (p. N).
3. Every question answer must be grounded in — and verifiable against — the
   chapter text.
4. All content must match the complexity of Grade {grade}: {guidance}
5. Produce all 10 sections in the exact XML format the user message specifies.

══ BOOK INFORMATION ══
Title   : {book_title}
Author  : {author}
Chapter : {chapter_num} — {chapter_title}
Grade   : {grade}

══ CHAPTER TEXT (with page markers for citation) ══
{chapter_text}
"""


def build_user_prompt(grade: int, chapter_json: Dict[str, Any]) -> str:
    """
    Build the user-turn prompt that contains the section instructions and
    output format spec.  This varies per grade/request so it is not cached.
    """
    book_title = chapter_json.get("book_title", "this book")
    chapter_num = chapter_json.get("chapter_num", "")
    chapter_title = chapter_json.get("chapter_title", "")
    author = chapter_json.get("author", "")
    guidance = GRADE_GUIDANCE.get(grade, GRADE_GUIDANCE[5])

    return f"""\
Generate a complete Student Workbook for Grade {grade} students reading \
"{book_title}" by {author}, Chapter {chapter_num}: "{chapter_title}".

Complexity target: {guidance}

Requirements for each section:
• FOCUS_QUESTION — one compelling before-reading hook question.
• VOCABULARY — exactly 10 words; each BOOK_QUOTE must be verbatim from the
  chapter with a (p. N) citation; DEFINITION uses language appropriate for
  grade {grade}; EXAMPLE_SENTENCE is a brand-new original sentence.
• BASIC_COMPREHENSION — 6 questions; answers stated explicitly in the text.
• INFERENCE_QUESTIONS — 3 questions; answers require reading between the lines.
• ANALYSIS_QUESTIONS — 3 questions; character, theme, or author's craft.
• MULTIPLE_CHOICE — 3 questions; exactly one correct option per question.
• SHORT_ANSWER — 3 questions; answers must cite a specific page number.
• CREATIVE_RESPONSE — one writing prompt + 3 scaffolding hints.
• TIMELINE_EVENTS — exactly 7 events in correct chronological order.
• PREDICTION_SETUP — one sentence stem (e.g. "I predict that...").

{_OUTPUT_FORMAT}"""
