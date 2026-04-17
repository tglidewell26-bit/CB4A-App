import type { Book, GradeColors } from "./types";

export const GRADE_STANDARDS: Record<number, string[]> = {
  3: ["RL.3.1", "RL.3.3", "RL.3.4", "L.3.4", "L.3.5", "W.3.3", "SL.3.1"],
  4: ["RL.4.1", "RL.4.3", "RL.4.4", "L.4.4", "L.4.5", "W.4.3", "SL.4.1"],
  5: ["RL.5.1", "RL.5.3", "RL.5.4", "L.5.4", "L.5.5", "W.5.3", "RI.5.1"],
  6: ["RL.6.1", "RL.6.3", "RL.6.4", "L.6.4", "L.6.5", "W.6.3", "RI.6.1"],
  7: ["RL.7.1", "RL.7.3", "RL.7.4", "L.7.4", "L.7.5", "W.7.3", "RI.7.1"],
  8: ["RL.8.1", "RL.8.3", "RL.8.4", "L.8.4", "L.8.5", "W.8.3", "RI.8.1"],
};

export const KNOWN_AUTHORS: Record<string, string> = {
  "heidi": "Johanna Spyri",
  "treasure island": "Robert Louis Stevenson",
  "the secret garden": "Frances Hodgson Burnett",
  "oliver twist": "Charles Dickens",
  "little women": "Louisa May Alcott",
  "call of the wild": "Jack London",
  "the call of the wild": "Jack London",
  "black beauty": "Anna Sewell",
  "robin hood": "Howard Pyle",
  "the jungle book": "Rudyard Kipling",
  "white fang": "Jack London",
  "anne of green gables": "L.M. Montgomery",
  "the wind in the willows": "Kenneth Grahame",
  "swiss family robinson": "Johann David Wyss",
  "around the world in eighty days": "Jules Verne",
  "twenty thousand leagues under the sea": "Jules Verne",
  "moby dick": "Herman Melville",
  "huckleberry finn": "Mark Twain",
  "the adventures of tom sawyer": "Mark Twain",
  "a tale of two cities": "Charles Dickens",
  "great expectations": "Charles Dickens",
};

export const SAMPLE_BOOKS: Book[] = [
  {
    id: 1,
    title: "Heidi",
    author: "Johanna Spyri",
    grade: 3,
    chapters: [
      { id: 1, num: 1, title: "Going Up to the Alm-Uncle", pages: "1–13", status: "ready", date: "Apr 5, 2026" },
      { id: 2, num: 2, title: "At the Grandfather's", pages: "14–26", status: "ready", date: "Apr 5, 2026" },
      { id: 3, num: 3, title: "On the Pasture", pages: "27–38", status: "generating" },
    ],
  },
  {
    id: 2,
    title: "Treasure Island",
    author: "Robert Louis Stevenson",
    grade: 5,
    chapters: [
      { id: 1, num: 1, title: "The Old Sea-Dog at the Admiral Benbow", pages: "1–11", status: "ready", date: "Mar 28, 2026" },
    ],
  },
  {
    id: 3,
    title: "The Call of the Wild",
    author: "Jack London",
    grade: 7,
    chapters: [],
  },
];

export const GRADE_COLORS: Record<number, GradeColors> = {
  3: { bg: "#FFF7ED", border: "#FB923C", text: "#C2410C" },
  4: { bg: "#FEF3C7", border: "#FBBF24", text: "#B45309" },
  5: { bg: "#ECFDF5", border: "#34D399", text: "#065F46" },
  6: { bg: "#EFF6FF", border: "#60A5FA", text: "#1D4ED8" },
  7: { bg: "#F5F3FF", border: "#A78BFA", text: "#5B21B6" },
  8: { bg: "#FDF2F8", border: "#F472B6", text: "#9D174D" },
};
