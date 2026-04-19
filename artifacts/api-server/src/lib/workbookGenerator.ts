import { anthropic } from "@workspace/integrations-anthropic-ai";

const GRADE_GUIDANCE: Record<number, string> = {
  3: "Grade 3 (ages 8–9): Very simple vocabulary and short sentences. Comprehension questions are literal. Vocabulary definitions use only words a 3rd grader already knows. Creative prompt has heavy scaffolding.",
  4: "Grade 4 (ages 9–10): Clear, accessible language. Mix of literal and one or two simple inference questions. Definitions friendly and brief.",
  5: "Grade 5 (ages 10–11): Grade-appropriate language. Mix of literal and inferential questions. Students support answers with text evidence.",
  6: "Grade 6 (ages 11–12): More sophisticated language. Inference and basic analysis questions dominate. Vocabulary genuinely challenging. Text evidence required.",
  7: "Grade 7 (ages 12–13): Literary and analytical language. Character motivation, theme, author craft. Advanced vocabulary. Strong text evidence with page citations.",
  8: "Grade 8 (ages 13–14): Sophisticated literary analysis. Literary devices, thematic depth, in-depth character analysis. Challenging vocabulary with nuanced definitions.",
};

interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
}

function truncateText(text: string, maxChars = 80000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Text truncated for length]";
}

export async function generateWorkbook(meta: ChapterMeta): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);

  const systemPrompt = `You are a curriculum specialist for Classic Books for All (CB4A), creating Student Workbook content for young readers in grades 3–8.

CRITICAL RULES:
1. Use ONLY the chapter text provided. Never use outside knowledge.
2. All content must match Grade ${meta.grade}: ${guidance}
3. Produce all sections in the exact HTML format specified.

BOOK INFORMATION:
Title: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${meta.chapterNum ? meta.chapterNum + " — " : ""}${meta.chapterTitle}
Pages: ${meta.pages}
Grade: ${meta.grade}

CHAPTER TEXT:
${chapterText}`;

  const userPrompt = `Generate a complete Student Workbook as HTML for Grade ${meta.grade} students reading "${meta.bookTitle}" by ${meta.author}, Chapter: "${meta.chapterTitle}".

Produce a self-contained HTML fragment (no <html>/<body> tags) using this exact structure:

<div class="workbook">
  <h1 class="wb-title">Student Workbook</h1>
  <p class="wb-meta">${meta.bookTitle} · Chapter ${meta.chapterNum ?? ""}: ${meta.chapterTitle} · Grade ${meta.grade}</p>

  <section class="wb-section">
    <h2>Before You Read</h2>
    <div class="focus-question">
      <p class="wb-label">Focus Question</p>
      <p>[One engaging before-reading question, grade-appropriate language]</p>
    </div>
  </section>

  <section class="wb-section">
    <h2>Vocabulary</h2>
    <p class="wb-instructions">For each word: find it in the chapter, learn its meaning, and use it in a sentence.</p>
    <div class="vocab-grid">
      <!-- 10 vocab items, each like: -->
      <div class="vocab-item">
        <p class="vocab-word">[word]</p>
        <p class="vocab-quote"><em>"[exact quote from text]" (p. [N])</em></p>
        <p class="vocab-def"><strong>Meaning:</strong> [grade-appropriate definition]</p>
        <p class="vocab-example"><strong>Example:</strong> [original example sentence]</p>
      </div>
      <!-- repeat for all 10 words -->
    </div>
  </section>

  <section class="wb-section">
    <h2>Basic Comprehension</h2>
    <p class="wb-instructions">Answer these questions using evidence from the chapter.</p>
    <ol class="question-list">
      <!-- 6 questions, each like: -->
      <li class="question-item">
        <p class="question">[literal question]</p>
        <div class="answer-space"></div>
      </li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Reading Between the Lines</h2>
    <p class="wb-instructions">These questions require you to make inferences — think carefully!</p>
    <ol class="question-list">
      <!-- 3 inference questions -->
      <li class="question-item">
        <p class="question">[inference question]</p>
        <div class="answer-space"></div>
      </li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Analysis Questions</h2>
    <p class="wb-instructions">Dig deeper into character, theme, or the author's craft.</p>
    <ol class="question-list">
      <!-- 3 analysis questions -->
      <li class="question-item">
        <p class="question">[analysis question]</p>
        <div class="answer-space"></div>
      </li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Multiple Choice</h2>
    <ol class="mc-list">
      <!-- 3 MC questions, each like: -->
      <li class="mc-item">
        <p class="question">[question]</p>
        <ul class="mc-options">
          <li>A. [option A]</li>
          <li>B. [option B]</li>
          <li>C. [option C]</li>
          <li>D. [option D]</li>
        </ul>
      </li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Short Answer</h2>
    <p class="wb-instructions">Use a specific page number to support your answer.</p>
    <ol class="question-list">
      <!-- 3 short answer questions -->
      <li class="question-item">
        <p class="question">[short answer question]</p>
        <div class="answer-space"></div>
      </li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Creative Response</h2>
    <p class="wb-instructions creative-prompt">[writing prompt appropriate to the chapter and grade]</p>
    <ul class="hints">
      <li>[scaffolding hint 1]</li>
      <li>[scaffolding hint 2]</li>
      <li>[scaffolding hint 3]</li>
    </ul>
    <div class="writing-space"></div>
  </section>

  <section class="wb-section">
    <h2>Chapter Timeline</h2>
    <p class="wb-instructions">Put these events in the correct order they happened in the chapter.</p>
    <ol class="timeline-list">
      <li>[key event 1 in chronological order]</li>
      <li>[key event 2]</li>
      <li>[key event 3]</li>
      <li>[key event 4]</li>
      <li>[key event 5]</li>
      <li>[key event 6]</li>
      <li>[key event 7]</li>
    </ol>
  </section>

  <section class="wb-section">
    <h2>Thinking Deeper</h2>
    <p class="prediction-stem">[One sentence prediction starter, e.g. "Based on what happened in this chapter, I predict that..."]</p>
    <div class="writing-space"></div>
  </section>
</div>

Fill in all placeholder text with real content based only on the chapter provided. Do not include any text outside the <div class="workbook"> tags.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

export async function generateTeacherGuide(meta: ChapterMeta): Promise<string> {
  const guidance = GRADE_GUIDANCE[meta.grade] ?? GRADE_GUIDANCE[5];
  const chapterText = truncateText(meta.extractedText);

  const systemPrompt = `You are a curriculum specialist for Classic Books for All (CB4A), creating Teacher Guide content for educators teaching grades 3–8.

CRITICAL RULES:
1. Use ONLY the chapter text provided. Never use outside knowledge.
2. All content must be tailored to Grade ${meta.grade}: ${guidance}
3. Produce the guide in the exact HTML format specified.

BOOK INFORMATION:
Title: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${meta.chapterNum ? meta.chapterNum + " — " : ""}${meta.chapterTitle}
Pages: ${meta.pages}
Grade: ${meta.grade}

CHAPTER TEXT:
${chapterText}`;

  const userPrompt = `Generate a comprehensive Teacher Guide as HTML for Grade ${meta.grade} instruction of "${meta.bookTitle}" by ${meta.author}, Chapter: "${meta.chapterTitle}".

Produce a self-contained HTML fragment (no <html>/<body> tags) using this exact structure:

<div class="teacher-guide">
  <h1 class="tg-title">Teacher Guide</h1>
  <p class="tg-meta">${meta.bookTitle} · Chapter ${meta.chapterNum ?? ""}: ${meta.chapterTitle} · Grade ${meta.grade}</p>

  <section class="tg-section">
    <h2>Chapter Overview</h2>
    <p>[2–3 sentence summary of the chapter for teacher reference]</p>
    <p><strong>Key themes:</strong> [comma-separated list of 3–5 themes]</p>
    <p><strong>Literary devices:</strong> [comma-separated list of notable devices used]</p>
  </section>

  <section class="tg-section">
    <h2>Learning Objectives</h2>
    <p class="tg-instructions">By the end of this chapter study, students will be able to:</p>
    <ul class="objectives-list">
      <li>[objective 1 aligned to California Common Core Grade ${meta.grade}]</li>
      <li>[objective 2]</li>
      <li>[objective 3]</li>
      <li>[objective 4]</li>
    </ul>
  </section>

  <section class="tg-section">
    <h2>Vocabulary Teaching Guide</h2>
    <p class="tg-instructions">Suggested strategies for teaching the 10 vocabulary words from the Student Workbook.</p>
    <div class="vocab-guide">
      <!-- 10 entries, each like: -->
      <div class="vocab-entry">
        <p class="vocab-word">[word]</p>
        <p><strong>Context in text:</strong> [brief explanation of how the word is used]</p>
        <p><strong>Teaching tip:</strong> [practical tip for teaching this word to Grade ${meta.grade} students]</p>
        <p><strong>Common misconception:</strong> [one common mistake students make with this word]</p>
      </div>
    </div>
  </section>

  <section class="tg-section">
    <h2>Answer Key — Basic Comprehension</h2>
    <p class="tg-instructions">Expected answers for the 6 basic comprehension questions.</p>
    <ol class="answer-list">
      <li class="answer-item">
        <p class="question">[question]</p>
        <p class="answer"><strong>Answer:</strong> [full expected answer with page reference]</p>
      </li>
      <!-- repeat for all 6 questions -->
    </ol>
  </section>

  <section class="tg-section">
    <h2>Answer Key — Inference Questions</h2>
    <ol class="answer-list">
      <li class="answer-item">
        <p class="question">[question]</p>
        <p class="answer"><strong>Sample answer:</strong> [expected answer]</p>
        <p class="discussion-note"><em>Discussion note:</em> [what to listen for in student responses]</p>
      </li>
      <!-- repeat for all 3 questions -->
    </ol>
  </section>

  <section class="tg-section">
    <h2>Answer Key — Analysis Questions</h2>
    <ol class="answer-list">
      <li class="answer-item">
        <p class="question">[question]</p>
        <p class="answer"><strong>Sample answer:</strong> [expected answer]</p>
        <p class="discussion-note"><em>Discussion note:</em> [what to listen for]</p>
      </li>
      <!-- repeat for all 3 questions -->
    </ol>
  </section>

  <section class="tg-section">
    <h2>Multiple Choice Answer Key</h2>
    <ol class="mc-answers">
      <li><strong>Question 1:</strong> [correct letter] — <em>[brief explanation why]</em></li>
      <li><strong>Question 2:</strong> [correct letter] — <em>[brief explanation why]</em></li>
      <li><strong>Question 3:</strong> [correct letter] — <em>[brief explanation why]</em></li>
    </ol>
  </section>

  <section class="tg-section">
    <h2>Discussion Questions</h2>
    <p class="tg-instructions">Use these for Socratic seminar or small-group discussion.</p>
    <ol class="discussion-list">
      <li class="discussion-item">
        <p class="question">[discussion question]</p>
        <p class="guiding-points"><strong>Guiding points:</strong> [2–3 bullet points of what students might say]</p>
      </li>
      <!-- 5 discussion questions total -->
    </ol>
  </section>

  <section class="tg-section">
    <h2>Differentiation Strategies</h2>
    <div class="diff-grid">
      <div class="diff-card">
        <h3>Struggling Readers</h3>
        <ul>
          <li>[strategy 1]</li>
          <li>[strategy 2]</li>
          <li>[strategy 3]</li>
        </ul>
      </div>
      <div class="diff-card">
        <h3>On-Level Readers</h3>
        <ul>
          <li>[strategy 1]</li>
          <li>[strategy 2]</li>
          <li>[strategy 3]</li>
        </ul>
      </div>
      <div class="diff-card">
        <h3>Advanced Readers</h3>
        <ul>
          <li>[strategy 1]</li>
          <li>[strategy 2]</li>
          <li>[strategy 3]</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="tg-section">
    <h2>Extension Activities</h2>
    <ul class="extension-list">
      <li><strong>[Activity name]:</strong> [description — 1–2 sentences]</li>
      <li><strong>[Activity name]:</strong> [description]</li>
      <li><strong>[Activity name]:</strong> [description]</li>
    </ul>
  </section>

  <section class="tg-section">
    <h2>Assessment Rubric — Short Answer & Creative Response</h2>
    <table class="rubric-table">
      <thead>
        <tr><th>Score</th><th>Criteria</th></tr>
      </thead>
      <tbody>
        <tr><td>4</td><td>[exemplary criteria for Grade ${meta.grade}]</td></tr>
        <tr><td>3</td><td>[proficient criteria]</td></tr>
        <tr><td>2</td><td>[developing criteria]</td></tr>
        <tr><td>1</td><td>[beginning criteria]</td></tr>
      </tbody>
    </table>
  </section>
</div>

Fill in all placeholder text with real content based only on the chapter provided. Do not include any text outside the <div class="teacher-guide"> tags.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
