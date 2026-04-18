#!/usr/bin/env python3
"""
Test the Teacher Guide Generator with Heidi Chapter 1 JSON.

If ANTHROPIC_API_KEY exists, this script calls Claude.
If no API key is present, it falls back to a deterministic mock XML payload
so doc generation can still be validated end-to-end.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from teacher_generator.generator import generate_teacher_guide, TeacherGeneratorError

SAMPLE_JSON = os.path.join(os.path.dirname(__file__), "heidi_ch1_sample.json")
OUTPUT_DOCX = os.path.join(os.path.dirname(__file__), "heidi_ch1_teacher_guide.docx")


def _mock_teacher_xml() -> str:
    return """<TEACHER_GUIDE>
<LESSON_OVERVIEW>Students complete vocabulary, guided reading, and text-based discussion in a 60-minute lesson (or two 30-minute sessions).</LESSON_OVERVIEW>
<MEASURABLE_OBJECTIVES>
<OBJECTIVE_1>Students will be able to identify key details about Heidi's introduction using textual evidence (RL.3.1).</OBJECTIVE_1>
<OBJECTIVE_2>Students will be able to describe character traits with supporting details (RL.3.3).</OBJECTIVE_2>
<OBJECTIVE_3>Students will be able to determine the meaning of unfamiliar words from context (L.3.4).</OBJECTIVE_3>
<OBJECTIVE_4>Students will be able to ask and answer questions in discussion with complete sentences (SL.3.1).</OBJECTIVE_4>
<OBJECTIVE_5>Students will be able to write short evidence-based responses with citations (W.3.9).</OBJECTIVE_5>
</MEASURABLE_OBJECTIVES>
<STANDARDS_LIST>RL.3.1: Ask and answer questions to demonstrate understanding of a text.
RL.3.3: Describe characters and explain how actions contribute to events.
L.3.4: Determine or clarify meaning of unknown words and phrases.
SL.3.1: Engage effectively in collaborative discussions.
W.3.9: Recall information from literary text to answer questions.</STANDARDS_LIST>
<MATERIALS_NEEDED>• Heidi chapter pages
• Student workbook
• Teacher guide
• Chart paper
• Sticky notes
• Pencils</MATERIALS_NEEDED>
<GET_READY_TO_READ>Quick Write: "What would it feel like to leave your home for a new place?" Steps: display prompt, 5-minute write, partner share, connect to Heidi's journey. Teaching tip: model one sentence starter.</GET_READY_TO_READ>
<VOCABULARY_MINI_LESSON>
<INTRO_INSTRUCTIONS>Introduce words through chapter context first, not dictionary-first.</INTRO_INSTRUCTIONS>
<PARTNER_PRACTICE>Partners create one oral sentence for each word stem.</PARTNER_PRACTICE>
<QUICK_CHECK>Thumbs check: students match a word to the best context clue.</QUICK_CHECK>
<WORD_1><WORD>cozy</WORD><PAGE>1</PAGE><KID_FRIENDLY_DEFINITION>warm and comfortable</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"In the cozy little town..." (p. 1)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>The blanket made the corner cozy.</EXAMPLE_SENTENCE></WORD_1>
<WORD_2><WORD>steep</WORD><PAGE>2</PAGE><KID_FRIENDLY_DEFINITION>rising sharply upward</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"...the steep path..." (p. 2)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>We walked up the steep hill.</EXAMPLE_SENTENCE></WORD_2>
<WORD_3><WORD>muttered</WORD><PAGE>2</PAGE><KID_FRIENDLY_DEFINITION>spoke in a low, unclear voice</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"She muttered..." (p. 2)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>He muttered when he was upset.</EXAMPLE_SENTENCE></WORD_3>
<WORD_4><WORD>glanced</WORD><PAGE>2</PAGE><KID_FRIENDLY_DEFINITION>looked quickly</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"He glanced at Heidi..." (p. 2)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>I glanced at the clock.</EXAMPLE_SENTENCE></WORD_4>
<WORD_5><WORD>hesitated</WORD><PAGE>3</PAGE><KID_FRIENDLY_DEFINITION>paused because of uncertainty</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"Deta hesitated..." (p. 3)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>She hesitated before answering.</EXAMPLE_SENTENCE></WORD_5>
<WORD_6><WORD>stern</WORD><PAGE>3</PAGE><KID_FRIENDLY_DEFINITION>serious and strict</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"His stern expression..." (p. 3)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>The coach had a stern look.</EXAMPLE_SENTENCE></WORD_6>
<WORD_7><WORD>meadow</WORD><PAGE>4</PAGE><KID_FRIENDLY_DEFINITION>a wide field of grass</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"...across the meadow..." (p. 4)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>We sat in the meadow.</EXAMPLE_SENTENCE></WORD_7>
<WORD_8><WORD>delighted</WORD><PAGE>4</PAGE><KID_FRIENDLY_DEFINITION>very happy</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"Heidi was delighted..." (p. 4)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>I was delighted by the surprise.</EXAMPLE_SENTENCE></WORD_8>
<WORD_9><WORD>cautious</WORD><PAGE>5</PAGE><KID_FRIENDLY_DEFINITION>careful to avoid danger</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"Peter stayed cautious..." (p. 5)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>Be cautious near the edge.</EXAMPLE_SENTENCE></WORD_9>
<WORD_10><WORD>belong</WORD><PAGE>6</PAGE><KID_FRIENDLY_DEFINITION>to feel at home in a place</KID_FRIENDLY_DEFINITION><CONTEXT_SENTENCE>"...where she might belong." (p. 6)</CONTEXT_SENTENCE><EXAMPLE_SENTENCE>I belong in this class.</EXAMPLE_SENTENCE></WORD_10>
<DIFF_STRUGGLING_READERS>Preview words with visuals; clap syllables; highlight context clues.</DIFF_STRUGGLING_READERS>
<DIFF_ELL_STUDENTS>Use bilingual glossary cards; gestures; sentence frames.</DIFF_ELL_STUDENTS>
<DIFF_ADVANCED>Challenge students to identify connotation and synonym shades.</DIFF_ADVANCED>
</VOCABULARY_MINI_LESSON>
<GUIDED_READING>
<SECTION_1><PAGE_RANGE>1-2</PAGE_RANGE><READ_FROM>"In the cozy little town..."</READ_FROM><READ_TO>"...up the steep mountain path."</READ_TO><PAUSE_QUESTIONS>1) [comprehension] Where are Heidi and Deta going? 2) [inference] How does Heidi feel? 3) [analysis] What details set mood? 4) [evaluation] Is the trip a good idea?</PAUSE_QUESTIONS></SECTION_1>
<SECTION_2><PAGE_RANGE>3-4</PAGE_RANGE><READ_FROM>"At last they reached..."</READ_FROM><READ_TO>"...Heidi smiled at everything."</READ_TO><PAUSE_QUESTIONS>1) [comprehension] How does Alm-Uncle react? 2) [inference] Why does Deta speak quickly? 3) [analysis] What does dialogue show? 4) [evaluation] Who is most responsible for Heidi now?</PAUSE_QUESTIONS></SECTION_2>
<SECTION_3><PAGE_RANGE>5-6</PAGE_RANGE><READ_FROM>"Peter arrived..."</READ_FROM><READ_TO>"...the goats moved ahead."</READ_TO><PAUSE_QUESTIONS>1) [comprehension] Who is Peter? 2) [inference] Why is Peter quiet? 3) [analysis] How does setting influence action? 4) [evaluation] Is Heidi ready for mountain life?</PAUSE_QUESTIONS></SECTION_3>
<SECTION_4><PAGE_RANGE>7-8</PAGE_RANGE><READ_FROM>"As evening came..."</READ_FROM><READ_TO>"...Heidi fell asleep peacefully."</READ_TO><PAUSE_QUESTIONS>1) [comprehension] Where does Heidi sleep? 2) [inference] What does this suggest about her adjustment? 3) [analysis] What imagery appears here? 4) [evaluation] What might happen next?</PAUSE_QUESTIONS></SECTION_4>
<TEACHING_TIP>Use short read-aloud chunks and stop every 1-2 pages to annotate character feelings.</TEACHING_TIP>
<DIFF_STRUGGLING_READERS>Before: preview names and setting visuals. During: think-aloud for pronoun tracking.</DIFF_STRUGGLING_READERS>
<DIFF_ELL_STUDENTS>Connect mountain routines to students' lived experiences; provide sentence starters.</DIFF_ELL_STUDENTS>
<DIFF_ADVANCED>Ask craft-focused prompts about diction and narrator perspective.</DIFF_ADVANCED>
</GUIDED_READING>
<TIERED_DISCUSSION>
<LEVEL_1_LITERAL>Provide 4 literal questions with direct text answers and a tip.</LEVEL_1_LITERAL>
<LEVEL_2_INFERENTIAL>Provide 4 inferential questions with expected answers and a tip.</LEVEL_2_INFERENTIAL>
<LEVEL_3_ANALYTICAL>Provide 4 analytical questions with expected answers and a tip.</LEVEL_3_ANALYTICAL>
<LEVEL_4_PERSONAL>Provide 4 personal/evaluative questions with expected responses and a tip.</LEVEL_4_PERSONAL>
<DISCUSSION_MANAGEMENT_NOTES>Use turn-and-talk, cold call equitably, and require page-cited evidence in full-group share.</DISCUSSION_MANAGEMENT_NOTES>
</TIERED_DISCUSSION>
<THINK_ABOUT_THE_STORY_ANSWERS>Q1: ... A: ... (p. 1)
Q2: ... A: ... (p. 2)
Q3: ... A: ... (p. 3)
Q4: ... A: ... (p. 4)
Q5: ... A: ... (p. 5)
Q6: ... A: ... (p. 6)</THINK_ABOUT_THE_STORY_ANSWERS>
<READING_BETWEEN_THE_LINES_ANSWERS>Q1: ... A: ... (p. 2-3)
Q2: ... A: ... (p. 4)
Q3: ... A: ... (p. 5-6)</READING_BETWEEN_THE_LINES_ANSWERS>
<DIG_DEEPER_ANSWERS>Q1: ... A: ... (p. 1, 3)
Q2: ... A: ... (p. 4, 6)
Q3: ... A: ... (p. 2, 5)</DIG_DEEPER_ANSWERS>
<MULTIPLE_CHOICE_ANSWERS>1) B — because ...
2) D — because ...
3) A — because ...</MULTIPLE_CHOICE_ANSWERS>
<SHORT_ANSWER_ANSWERS>SA1: ... (p. 3)
SA2: ... (p. 5)
SA3: ... (p. 6)</SHORT_ANSWER_ANSWERS>
<CREATIVE_RESPONSE_GUIDE>Errors: weak evidence, vague claims, tense shifts, no transitions, off-topic ending. Include fix guidance and teacher note lines.</CREATIVE_RESPONSE_GUIDE>
<CHARACTER_CHART_ANSWER_KEY>Heidi, Deta, Alm-Uncle, Peter, Barbara each include behavior, traits, and evidence (p. N).</CHARACTER_CHART_ANSWER_KEY>
<TIMELINE_ANSWER_KEY>1) Deta takes Heidi up the mountain ... 7) Heidi falls asleep in the loft.</TIMELINE_ANSWER_KEY>
<EXIT_TICKET_GUIDE>Success criteria (3 bullets), strong/developing/needs support samples, collection note.</EXIT_TICKET_GUIDE>
<DIFFERENTIATION_SUMMARY>Struggling readers: before/during/after + accommodations.
ELL: beginning/intermediate/advanced + cultural connections + assessment mods.
Advanced: reading extensions, vocabulary enrichment, character study, literary analysis.</DIFFERENTIATION_SUMMARY>
</TEACHER_GUIDE>"""


def main() -> None:
    with open(SAMPLE_JSON) as f:
        chapter_json = json.load(f)

    grade = int(chapter_json.get("grade", 3))
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    try:
        if api_key.startswith("sk-"):
            print("API key found. Generating Teacher Guide with Claude…")
            buf = generate_teacher_guide(chapter_json, grade=grade)
        else:
            print("No valid ANTHROPIC_API_KEY found. Using deterministic mock response for dry run…")
            buf = generate_teacher_guide(
                chapter_json,
                grade=grade,
                mock_response_text=_mock_teacher_xml(),
            )
    except TeacherGeneratorError as exc:
        print(f"Generator failed: {exc}")
        sys.exit(1)

    with open(OUTPUT_DOCX, "wb") as f:
        f.write(buf.read())

    print(f"Saved: {OUTPUT_DOCX}")
    print(f"Size: {os.path.getsize(OUTPUT_DOCX)/1024:.1f} KB")


if __name__ == "__main__":
    main()
