export interface VocabularyWord {
  word: string;
  page_number: number;
  book_quote: string;
  grade_band: string;
  score: number;
  kid_friendly_definition?: string;
  context_sentence?: string;
  example_sentence?: string;
}
