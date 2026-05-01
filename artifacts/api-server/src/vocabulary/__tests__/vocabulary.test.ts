import { describe, it, expect } from "vitest";

import {
  normalizeToken,
  lemmatize,
  selectVocabWords,
} from "../selector.js";

import {
  parseChapterPages,
  enrichSelectedVocabWords,
} from "../enricher.js";

import { GRADE_VOCAB } from "../gradeWordPools.js";

// ---------------------------------------------------------------------------
// Section 1 — normalizeToken and lemmatize unit tests
// ---------------------------------------------------------------------------

describe("normalizeToken", () => {
  it("lowercases letters", () => {
    expect(normalizeToken("Ability")).toBe("ability");
    expect(normalizeToken("ANCIENT")).toBe("ancient");
  });

  it("strips apostrophes (e.g. contractions and possessives)", () => {
    expect(normalizeToken("don't")).toBe("dont");
    expect(normalizeToken("they've")).toBe("theyve");
    expect(normalizeToken("child's")).toBe("childs");
  });

  it("strips hyphens", () => {
    expect(normalizeToken("well-known")).toBe("wellknown");
    expect(normalizeToken("self-reliant")).toBe("selfreliant");
  });

  it("strips digits and punctuation", () => {
    expect(normalizeToken("1st")).toBe("st");
    expect(normalizeToken("co-op.")).toBe("coop");
  });

  it("returns empty string for all-non-letter input", () => {
    expect(normalizeToken("---")).toBe("");
    expect(normalizeToken("123")).toBe("");
  });
});

describe("lemmatize", () => {
  it("strips -ies → -y when length > 4", () => {
    expect(lemmatize("abilities")).toBe("ability");
    expect(lemmatize("babies")).toBe("baby");
  });

  it("short -ies tokens (length <= 4) fall through to the -s branch", () => {
    expect(lemmatize("ties")).toBe("tie");
    expect(lemmatize("pies")).toBe("pie");
  });

  it("strips -ing when length > 5", () => {
    expect(lemmatize("running")).toBe("runn");
    expect(lemmatize("walking")).toBe("walk");
    expect(lemmatize("absorbing")).toBe("absorb");
  });

  it("does NOT strip -ing on short tokens (length <= 5)", () => {
    expect(lemmatize("ring")).toBe("ring");
    expect(lemmatize("king")).toBe("king");
    expect(lemmatize("sting")).toBe("sting");
  });

  it("strips -ed when length > 4", () => {
    expect(lemmatize("walked")).toBe("walk");
    expect(lemmatize("struggled")).toBe("struggl");
    expect(lemmatize("absorbed")).toBe("absorb");
  });

  it("does NOT strip -ed on short tokens (length <= 4)", () => {
    expect(lemmatize("bled")).toBe("bled");
    expect(lemmatize("sled")).toBe("sled");
  });

  it("strips -es when length > 4", () => {
    expect(lemmatize("houses")).toBe("hous");
    expect(lemmatize("torches")).toBe("torch");
  });

  it("short -es tokens (length <= 4) fall through to the -s branch", () => {
    expect(lemmatize("bees")).toBe("bee");
    expect(lemmatize("toes")).toBe("toe");
  });

  it("strips trailing -s when length > 3", () => {
    expect(lemmatize("antics")).toBe("antic");
    expect(lemmatize("cats")).toBe("cat");
  });

  it("does NOT strip -s on tokens with length <= 3", () => {
    expect(lemmatize("bus")).toBe("bus");
    expect(lemmatize("its")).toBe("its");
  });

  it("does NOT strip -ly (no -ly handling — preserve current behavior)", () => {
    expect(lemmatize("cautiously")).toBe("cautiously");
    expect(lemmatize("carefully")).toBe("carefully");
    expect(lemmatize("gradually")).toBe("gradually");
  });

  it("returns token unchanged when no suffix matches", () => {
    expect(lemmatize("ancient")).toBe("ancient");
    expect(lemmatize("ability")).toBe("ability");
  });

  it("-ies takes priority over -ing/-ed/-es/-s (first matching branch wins)", () => {
    expect(lemmatize("studies")).toBe("study");
  });

  it("-ing takes priority over -ed/-es/-s", () => {
    expect(lemmatize("singing")).toBe("sing");
  });
});

// ---------------------------------------------------------------------------
// Section 2 — selectVocabWords: tokenizer regex and 3-char minimum
// ---------------------------------------------------------------------------

describe("selectVocabWords — tokenizer and 3-char minimum", () => {
  it("returns empty array when text contains only 1-2 char words", () => {
    const text = "he an be go to do it am";
    const result = selectVocabWords(text, 3);
    expect(result).toEqual([]);
  });

  it("captures exactly 3-char words (the minimum)", () => {
    const text = "the act was bold";
    const result = selectVocabWords(text, 3);
    expect(result).toContain("act");
    expect(result).toContain("bold");
  });

  it("apostrophes in text do not break token matching", () => {
    const text = "the child's ability is ancient";
    const result = selectVocabWords(text, 3);
    expect(result).toContain("ability");
    expect(result).toContain("ancient");
  });

  it("hyphens in text do not break token matching for other pool words", () => {
    const text = "well-known ability is ancient";
    const result = selectVocabWords(text, 3);
    expect(result).toContain("ability");
    expect(result).toContain("ancient");
  });

  it("text tokens are normalized but NOT lemmatized (plurals don't back-match pool stems)", () => {
    const text = "the abilities of children are vast";
    const grade3Result = selectVocabWords(text, 3);
    expect(grade3Result).not.toContain("ability");
  });
});

// ---------------------------------------------------------------------------
// Section 3 — selectVocabWords: lemma matching via pool words
// ---------------------------------------------------------------------------

describe("selectVocabWords — lemma-path matching", () => {
  it("matches pool word 'struggled' (grade 3) when text contains lemma 'struggl'", () => {
    const text = "the child struggl with many obstacles each day for weeks";
    const result = selectVocabWords(text, 3);
    expect(result).toContain("struggl");
  });

  it("matches grade-7 pool word 'antics' when text contains its lemma stem 'antic'", () => {
    const text = "the antic of the performer was quite memorable and bold";
    const result = selectVocabWords(text, 7);
    expect(result).toContain("antic");
  });

  it("'cautiously' (grade 5) does NOT match when text has only 'caution' (-ly not stripped)", () => {
    const text = "she acted with great caution and care during the ordeal";
    const result = selectVocabWords(text, 5);
    expect(result).not.toContain("cautiously");
    expect(result).not.toContain("caution");
  });

  it("matches 'cautiously' directly when text contains 'cautiously'", () => {
    const text = "she moved cautiously through the dense wilderness every step";
    const result = selectVocabWords(text, 5);
    expect(result).toContain("cautiously");
  });
});

// ---------------------------------------------------------------------------
// Section 4 — selectVocabWords: BATCH_SIZE=10 expansion
// ---------------------------------------------------------------------------

describe("selectVocabWords — BATCH_SIZE=10 expansion", () => {
  it("selects words from the 2nd batch (positions 10-19) when 1st batch has no hits", () => {
    const grade3Pool0to9 = [
      "ability", "absorb", "accuse", "act", "active",
      "actual", "adopt", "advantage", "advice", "ambition",
    ];
    const grade3Pool10to19 = [
      "ancient", "approach", "arrange", "arctic", "attitude",
      "attract", "average", "avoid", "bold", "border",
    ];

    const textWithOnlyBatch2Words =
      "the ancient approach was to arrange things in the arctic regions " +
      "the attitude was to attract average results and avoid bold border issues";

    const result = selectVocabWords(textWithOnlyBatch2Words, 3);

    for (const w of grade3Pool0to9) {
      expect(result).not.toContain(w);
    }

    for (const w of grade3Pool10to19) {
      expect(result).toContain(w);
    }
  });

  it("caps results at 10 words even when many pool words are present in the text", () => {
    const lotsOfGrade3Words =
      "ability absorb accuse act active actual adopt advantage advice ambition " +
      "ancient approach arrange arctic attitude attract average avoid bold border " +
      "brief brilliant capture certain chill clever climate cling coast confess";

    const result = selectVocabWords(lotsOfGrade3Words, 3);
    expect(result.length).toBe(10);
  });

  it("returns fewer than 10 words when only a few pool words exist in the text", () => {
    const text = "the ability of the ancient world";
    const result = selectVocabWords(text, 3);
    expect(result.length).toBeLessThan(10);
    expect(result).toContain("ability");
    expect(result).toContain("ancient");
  });

  it("returns words in pool order, not text order", () => {
    const text = "ancient ability";
    const result = selectVocabWords(text, 3);
    expect(result[0]).toBe("ability");
    expect(result[1]).toBe("ancient");
  });
});

// ---------------------------------------------------------------------------
// Section 5 — selectVocabWords: multi-token pool entries never match
// ---------------------------------------------------------------------------

describe("selectVocabWords — multi-token pool entries (preserve no-match behavior)", () => {
  it("'vice versa' (grade 7+) never matches even when both words are present in text", () => {
    const text =
      "everything went vice versa in this unusual scenario the outcome was the opposite";
    const result = selectVocabWords(text, 7);
    expect(result).not.toContain("viceversa");
    expect(result).not.toContain("vice versa");
    expect(result).not.toContain("vice");
    expect(result).not.toContain("versa");
  });

  it("'vice versa' (grade 8) never matches when grade is clamped to same pool", () => {
    const text = "vice versa the result was completely unexpected and strange";
    const result = selectVocabWords(text, 8);
    expect(result).not.toContain("viceversa");
    expect(result).not.toContain("vice versa");
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Grade clamping
// ---------------------------------------------------------------------------

describe("selectVocabWords — grade clamping", () => {
  it("grade below 3 is treated as 3", () => {
    const textWithGrade3Word = "the ability of the child was brilliant";
    const resultAt1 = selectVocabWords(textWithGrade3Word, 1);
    const resultAt3 = selectVocabWords(textWithGrade3Word, 3);
    expect(resultAt1).toEqual(resultAt3);
  });

  it("grade above 8 is treated as 8", () => {
    const textWithGrade8Word = "the advocate argued that the doctrine was abet";
    const resultAt9 = selectVocabWords(textWithGrade8Word, 9);
    const resultAt8 = selectVocabWords(textWithGrade8Word, 8);
    expect(resultAt9).toEqual(resultAt8);
  });
});

// ---------------------------------------------------------------------------
// Section 7 — parseChapterPages: [PAGE N] marker format
// ---------------------------------------------------------------------------

describe("parseChapterPages — [PAGE N] markers", () => {
  it("parses a single [PAGE N] marker", () => {
    const text = "[PAGE 1]\nThe first line of the chapter.\n";
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_number).toBe(1);
    expect(pages[0].text).toBe("The first line of the chapter.");
  });

  it("parses multiple [PAGE N] markers in sequence", () => {
    const text =
      "[PAGE 1]\nText on page one. It tells a story.\n" +
      "[PAGE 2]\nText on page two. Another tale.\n" +
      "[PAGE 3]\nText on page three. The conclusion.\n";
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(3);
    expect(pages[0].page_number).toBe(1);
    expect(pages[1].page_number).toBe(2);
    expect(pages[2].page_number).toBe(3);
    expect(pages[0].text).toContain("page one");
    expect(pages[1].text).toContain("page two");
    expect(pages[2].text).toContain("page three");
  });

  it("uses non-sequential page numbers as specified by markers", () => {
    const text = "[PAGE 5]\nFirst chunk.\n[PAGE 10]\nSecond chunk.\n";
    const pages = parseChapterPages(text);
    expect(pages[0].page_number).toBe(5);
    expect(pages[1].page_number).toBe(10);
  });

  it("skips empty pages between markers", () => {
    const text = "[PAGE 1]\n   \n[PAGE 2]\nSome actual content here.\n";
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_number).toBe(2);
    expect(pages[0].text).toContain("actual content");
  });

  it("prefers [PAGE N] markers over ---PAGE--- separators when both present", () => {
    const textWithBoth =
      "[PAGE 1]\nPage one content here.\n" +
      "\n\n---PAGE---\n\n" +
      "separator content";
    const pages = parseChapterPages(textWithBoth);
    expect(pages[0].page_number).toBe(1);
    expect(pages[0].text).toContain("Page one content here.");
  });
});

// ---------------------------------------------------------------------------
// Section 8 — parseChapterPages: ---PAGE--- separator fallback
// ---------------------------------------------------------------------------

describe("parseChapterPages — ---PAGE--- separator fallback", () => {
  it("splits on PAGE_SEPARATOR and assigns sequential page numbers", () => {
    const PAGE_SEP = "\n\n---PAGE---\n\n";
    const text = `First page content.${PAGE_SEP}Second page content.${PAGE_SEP}Third page content.`;
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(3);
    expect(pages[0].page_number).toBe(1);
    expect(pages[1].page_number).toBe(2);
    expect(pages[2].page_number).toBe(3);
    expect(pages[0].text).toBe("First page content.");
    expect(pages[1].text).toBe("Second page content.");
    expect(pages[2].text).toBe("Third page content.");
  });

  it("assigns sequential page numbers (1-based) when segments have no inline [PAGE N] markers", () => {
    const PAGE_SEP = "\n\n---PAGE---\n\n";
    const text = `Alpha content here.${PAGE_SEP}Beta content here.${PAGE_SEP}Gamma content here.`;
    const pages = parseChapterPages(text);
    expect(pages[0].page_number).toBe(1);
    expect(pages[0].text).toBe("Alpha content here.");
    expect(pages[1].page_number).toBe(2);
    expect(pages[1].text).toBe("Beta content here.");
    expect(pages[2].page_number).toBe(3);
    expect(pages[2].text).toBe("Gamma content here.");
  });

  it("filters out empty segments", () => {
    const PAGE_SEP = "\n\n---PAGE---\n\n";
    const text = `Valid content here.${PAGE_SEP}   ${PAGE_SEP}Also valid.`;
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(2);
    expect(pages[0].text).toBe("Valid content here.");
    expect(pages[1].text).toBe("Also valid.");
  });

  it("returns single page when no separators present", () => {
    const text = "A single block of text with no page separators at all.";
    const pages = parseChapterPages(text);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_number).toBe(1);
    expect(pages[0].text).toBe(
      "A single block of text with no page separators at all."
    );
  });
});

// ---------------------------------------------------------------------------
// Section 9 — enrichSelectedVocabWords: first-page lookup and sentence quoting
// ---------------------------------------------------------------------------

describe("enrichSelectedVocabWords", () => {
  const PAGE_SEP = "\n\n---PAGE---\n\n";

  it("finds the word on its first page of occurrence", () => {
    const text =
      "[PAGE 1]\nThe ancient ruins were discovered by the explorers.\n" +
      "[PAGE 2]\nThe ancient temple was enormous. The ability of builders was vast.\n";
    const [result] = enrichSelectedVocabWords(["ancient"], text, 3);
    expect(result.page_number).toBe(1);
  });

  it("returns word on page 2 when it appears only there", () => {
    const text =
      "[PAGE 1]\nNothing special on this page at all.\n" +
      "[PAGE 2]\nThe brilliant idea emerged from the ancient tome.\n";
    const [result] = enrichSelectedVocabWords(["brilliant"], text, 3);
    expect(result.page_number).toBe(2);
    expect(result.word).toBe("brilliant");
  });

  it("produces case-insensitive first-page lookup", () => {
    const text = "[PAGE 1]\nThe ABILITY of the child was remarkable.\n";
    const [result] = enrichSelectedVocabWords(["ability"], text, 3);
    expect(result.page_number).toBe(1);
    expect(result.book_quote).toContain("ABILITY");
  });

  it("book_quote contains the sentence with the word", () => {
    const text =
      "[PAGE 1]\nThe adventure was long. " +
      "The ability of the young hero was legendary. " +
      "Many dangers lay ahead.\n";
    const [result] = enrichSelectedVocabWords(["ability"], text, 3);
    expect(result.book_quote).toContain("ability");
    expect(result.book_quote).toContain("hero");
  });

  it("book_quote is truncated to 220 chars maximum", () => {
    const longSentence =
      "The ability of the extraordinarily talented young hero was legendary and celebrated throughout the vast kingdom for many generations and spoken of in all the ancient texts that anyone could ever find ";
    const text = `[PAGE 1]\n${longSentence}\n`;
    const [result] = enrichSelectedVocabWords(["ability"], text, 3);
    expect(result.book_quote.length).toBeLessThanOrEqual(220);
  });

  it("sets correct grade_band (e.g., grade 4 → '4-6')", () => {
    const text = "[PAGE 1]\nThe ability of the child was remarkable.\n";
    const [result] = enrichSelectedVocabWords(["ability"], text, 4);
    expect(result.grade_band).toBe("4-6");
  });

  it("clamps grade_band top at 8 (grade 7 → '7-8' not '7-9')", () => {
    const text = "[PAGE 1]\nThe advocate argued the case with great skill.\n";
    const [result] = enrichSelectedVocabWords(["advocate"], text, 7);
    expect(result.grade_band).toBe("7-8");
  });

  it("sets score to 1.0 for all enriched words", () => {
    const text =
      "[PAGE 1]\nThe ancient ability of the child was brilliant.\n";
    const results = enrichSelectedVocabWords(
      ["ancient", "ability", "brilliant"],
      text,
      3
    );
    for (const r of results) {
      expect(r.score).toBe(1.0);
    }
  });

  it("omits words that do not appear anywhere in the text", () => {
    const text = "[PAGE 1]\nThe ancient ruins were discovered.\n";
    const results = enrichSelectedVocabWords(["ability", "ancient"], text, 3);
    const words = results.map((r) => r.word);
    expect(words).not.toContain("ability");
    expect(words).toContain("ancient");
  });

  it("works with ---PAGE--- separator format for first-page lookup", () => {
    const text =
      `Nothing here.${PAGE_SEP}The ancient ruins were discovered by the explorers.`;
    const [result] = enrichSelectedVocabWords(["ancient"], text, 3);
    expect(result.page_number).toBe(2);
  });

  it("whole-word match — does not match partial tokens (e.g. 'an' inside 'ancient')", () => {
    const text = "[PAGE 1]\nThe ancient ruins were discovered.\n";
    const results = enrichSelectedVocabWords(["anci"], text, 3);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Section 10 — GRADE_VOCAB data-integrity checks
// ---------------------------------------------------------------------------

const KNOWN_MULTI_TOKEN_ENTRIES = new Set(["vice versa"]);

const uniqueGradePools: Array<{ grade: number; words: string[] }> = [];
const seenArrays = new Set<string[]>();
for (const [gradeStr, words] of Object.entries(GRADE_VOCAB)) {
  if (!seenArrays.has(words)) {
    seenArrays.add(words);
    uniqueGradePools.push({ grade: Number(gradeStr), words });
  }
}

describe("GRADE_VOCAB data integrity — lowercase", () => {
  for (const { grade, words } of uniqueGradePools) {
    it(`every entry in grade ${grade} pool is already lowercase`, () => {
      const violations = words.filter((w) => w !== w.toLowerCase());
      expect(violations).toEqual([]);
    });
  }
});

describe("GRADE_VOCAB data integrity — no duplicates within a grade", () => {
  for (const { grade, words } of uniqueGradePools) {
    it(`grade ${grade} pool has no duplicate entries`, () => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const word of words) {
        if (seen.has(word)) {
          duplicates.push(word);
        }
        seen.add(word);
      }
      expect(duplicates).toEqual([]);
    });
  }
});

describe("GRADE_VOCAB data integrity — multi-token entries are all known", () => {
  for (const { grade, words } of uniqueGradePools) {
    it(`grade ${grade} pool has no unexpected multi-token entries (spaces)`, () => {
      const unexpected = words.filter(
        (w) => w.includes(" ") && !KNOWN_MULTI_TOKEN_ENTRIES.has(w)
      );
      expect(unexpected).toEqual([]);
    });
  }

  it("all known multi-token entries are still present in at least one grade pool", () => {
    const allWords = Object.values(GRADE_VOCAB).flat();
    for (const entry of KNOWN_MULTI_TOKEN_ENTRIES) {
      expect(allWords).toContain(entry);
    }
  });
});
