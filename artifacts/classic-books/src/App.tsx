import { useState } from "react";
import type { Book, Chapter } from "./types";
import { SAMPLE_BOOKS } from "./constants";
import { Sidebar } from "./components/Sidebar";
import { ChapterCard } from "./components/ChapterCard";
import { EmptyState } from "./components/EmptyState";
import { NewBookModal } from "./components/NewBookModal";
import { AddChapterModal } from "./components/AddChapterModal";

export default function App() {
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [selectedBook, setSelectedBook] = useState<Book | null>(SAMPLE_BOOKS[0]);
  const [showNewBook, setShowNewBook] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
  };

  const addBook = (bookData: Omit<Book, "id" | "chapters">) => {
    const newBook: Book = { ...bookData, id: Date.now(), chapters: [] };
    setBooks((prev) => [...prev, newBook]);
    setSelectedBook(newBook);
    setShowNewBook(false);
  };

  const addChapter = (chapterData: Omit<Chapter, "id" | "status">) => {
    if (!selectedBook) return;
    const newChapter: Chapter = { ...chapterData, id: Date.now(), status: "generating" };
    const updatedBook = { ...selectedBook, chapters: [...selectedBook.chapters, newChapter] };
    setBooks((prev) => prev.map((b) => (b.id === selectedBook.id ? updatedBook : b)));
    setSelectedBook(updatedBook);
    setShowAddChapter(false);
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "'Georgia', serif",
      background: "#F8F6F1",
      color: "#1C1917",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Source+Sans+3:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4C9B8; border-radius: 2px; }
        .book-row:hover { background: #F0EBE1 !important; }
        .book-row.active { background: #FFFFFF08 !important; border-left: 3px solid #92400E !important; }
        .chapter-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important; transform: translateY(-1px); }
        .btn-primary:hover { background: #78350F !important; }
        .btn-secondary:hover { background: #E8E0D4 !important; }
        .action-pill:hover { background: #92400E !important; color: white !important; border-color: #92400E !important; }
        .tag-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
          font-family: 'Source Sans 3', sans-serif;
          background: #FEF3C7;
          color: #92400E;
          border: 1px solid #FDE68A;
          margin: 2px 2px 2px 0;
        }
        input:focus, select:focus { outline: none; border-color: #92400E !important; }
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(2px);
        }
        .fade-in { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .chapter-card { transition: all 0.15s ease; }
        .btn-primary, .btn-secondary, .action-pill { transition: all 0.15s ease; cursor: pointer; }
        @keyframes progress { 0% { width: 20%; } 50% { width: 80%; } 100% { width: 20%; } }
      `}</style>

      <Sidebar
        books={books}
        selectedBook={selectedBook}
        onBookSelect={handleBookSelect}
        onNewBook={() => setShowNewBook(true)}
        open={sidebarOpen}
      />

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          padding: "16px 28px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E8E0D4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setSidebarOpen((p) => !p)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#78716C",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor" />
                <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor" />
                <rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>
            {selectedBook && (
              <div>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 500,
                  color: "#1C1917",
                }}>
                  {selectedBook.title}
                </div>
                <div style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 12,
                  color: "#78716C",
                  marginTop: 1,
                }}>
                  {selectedBook.author} · Grade {selectedBook.grade} · California Common Core
                </div>
              </div>
            )}
          </div>
          {selectedBook && (
            <button
              className="btn-primary"
              onClick={() => setShowAddChapter(true)}
              style={{
                padding: "8px 18px",
                background: "#92400E",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span style={{ fontSize: 15 }}>+</span> Add chapter
            </button>
          )}
        </div>

        {/* Chapter list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {!selectedBook ? (
            <EmptyState message="Select a book from the sidebar" />
          ) : selectedBook.chapters.length === 0 ? (
            <EmptyState message="No chapters yet — click Add chapter to get started" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 800 }}>
              {selectedBook.chapters.map((ch) => (
                <ChapterCard key={ch.id} chapter={ch} book={selectedBook} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewBook && (
        <NewBookModal onClose={() => setShowNewBook(false)} onSave={addBook} />
      )}
      {showAddChapter && selectedBook && (
        <AddChapterModal
          book={selectedBook}
          onClose={() => setShowAddChapter(false)}
          onSave={addChapter}
        />
      )}
    </div>
  );
}
