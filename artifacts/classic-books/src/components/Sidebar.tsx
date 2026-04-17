import type { Book } from "../types";
import { GRADE_COLORS } from "../constants";

interface SidebarProps {
  books: Book[];
  selectedBook: Book | null;
  onBookSelect: (book: Book) => void;
  onNewBook: () => void;
  open: boolean;
}

export function Sidebar({ books, selectedBook, onBookSelect, onNewBook, open }: SidebarProps) {
  return (
    <div style={{
      width: open ? 280 : 0,
      minWidth: open ? 280 : 0,
      background: "#1C1917",
      display: "flex",
      flexDirection: "column",
      transition: "all 0.25s ease",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #2C2824" }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 600,
          color: "#F5F0E8",
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
        }}>
          Classic Books
        </div>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 11,
          color: "#A8967E",
          marginTop: 2,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          Curriculum Generator
        </div>
      </div>

      <div style={{ padding: "12px 12px 8px" }}>
        <button
          className="btn-primary"
          onClick={onNewBook}
          style={{
            width: "100%",
            padding: "9px 14px",
            background: "#92400E",
            border: "none",
            borderRadius: 6,
            color: "white",
            fontFamily: "'Source Sans 3', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          New book folder
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {books.map(book => {
          const gc = GRADE_COLORS[book.grade];
          const isActive = selectedBook?.id === book.id;
          return (
            <div
              key={book.id}
              className={`book-row ${isActive ? "active" : ""}`}
              onClick={() => onBookSelect(book)}
              style={{
                padding: "12px 20px",
                cursor: "pointer",
                borderLeft: isActive ? "3px solid #92400E" : "3px solid transparent",
                background: isActive ? "#FFFFFF08" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? "#F5F0E8" : "#C4B5A0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {book.title}
                </span>
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: "'Source Sans 3', sans-serif",
                  background: gc.bg,
                  color: gc.text,
                  border: `1px solid ${gc.border}`,
                  flexShrink: 0,
                }}>
                  Gr {book.grade}
                </span>
              </div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#6B5D4E", whiteSpace: "nowrap" }}>
                {book.author} · {book.chapters.length} {book.chapters.length === 1 ? "chapter" : "chapters"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid #2C2824" }}>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 11,
          color: "#4A3F34",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}>
          classicbooksforall.com
        </div>
      </div>
    </div>
  );
}
