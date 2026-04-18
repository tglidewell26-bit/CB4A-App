import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Book, Chapter } from "./types";
import {
  useListBooks,
  useCreateBook,
  useListChapters,
  useCreateChapter,
  getListBooksQueryKey,
  getListChaptersQueryKey,
} from "@workspace/api-client-react";
import { Sidebar } from "./components/Sidebar";
import { ChapterCard } from "./components/ChapterCard";
import { EmptyState } from "./components/EmptyState";
import { NewBookModal } from "./components/NewBookModal";
import { AddChapterModal } from "./components/AddChapterModal";

export default function App() {
  const queryClient = useQueryClient();
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [showNewBook, setShowNewBook] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: apiBooks = [], isLoading: booksLoading } = useListBooks();
  const { data: apiChapters = [] } = useListChapters(selectedBookId ?? 0, {
    query: {
      queryKey: getListChaptersQueryKey(selectedBookId ?? 0),
      enabled: selectedBookId !== null,
    },
  });

  useEffect(() => {
    if (selectedBookId === null && apiBooks.length > 0) {
      setSelectedBookId(apiBooks[0].id);
    }
  }, [apiBooks, selectedBookId]);

  const createBookMutation = useCreateBook();
  const createChapterMutation = useCreateChapter();

  const booksForSidebar: Book[] = apiBooks.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    grade: b.grade as Book["grade"],
    chapters: Array.from({ length: b.chapterCount }, (_, i) => ({
      id: i,
      title: "",
      pages: "",
      status: "ready" as const,
    })),
  }));

  const selectedApiBook = apiBooks.find((b) => b.id === selectedBookId) ?? null;

  const selectedBookChapters: Chapter[] = apiChapters.map((c) => ({
    id: c.id,
    title: c.title,
    pages: c.pages,
    status: (c.status as Chapter["status"]) ?? "pending",
    num: c.num ?? undefined,
    date: c.date ?? undefined,
    file: c.file ?? undefined,
  }));

  const selectedBook: Book | null = selectedApiBook
    ? {
        id: selectedApiBook.id,
        title: selectedApiBook.title,
        author: selectedApiBook.author,
        grade: selectedApiBook.grade as Book["grade"],
        chapters: selectedBookChapters,
      }
    : null;

  const handleBookSelect = (book: Book) => {
    setSelectedBookId(book.id);
  };

  const addBook = (bookData: Omit<Book, "id" | "chapters">) => {
    createBookMutation.mutate(
      { data: { title: bookData.title, author: bookData.author, grade: bookData.grade } },
      {
        onSuccess: (newBook) => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          setSelectedBookId(newBook.id);
          setShowNewBook(false);
        },
      }
    );
  };

  const addChapter = (chapterData: Omit<Chapter, "id" | "status">) => {
    if (!selectedBookId) return;
    createChapterMutation.mutate(
      {
        bookId: selectedBookId,
        data: {
          title: chapterData.title,
          pages: chapterData.pages,
          num: chapterData.num,
          date: chapterData.date,
          file: chapterData.file,
          status: "generating",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey(selectedBookId) });
          setShowAddChapter(false);
        },
      }
    );
  };

  const deleteBook = (bookId: number) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (selectedBook?.id === bookId) {
      const remaining = books.filter((b) => b.id !== bookId);
      setSelectedBook(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const deleteChapter = (chapterId: number) => {
    if (!selectedBook) return;
    const updatedBook = { ...selectedBook, chapters: selectedBook.chapters.filter((c) => c.id !== chapterId) };
    setBooks((prev) => prev.map((b) => (b.id === selectedBook.id ? updatedBook : b)));
    setSelectedBook(updatedBook);
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
        .book-row.active { background: #FFFFFF !important; border-left: 3px solid #92400E !important; }
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
        books={booksForSidebar}
        selectedBook={selectedBook}
        onBookSelect={handleBookSelect}
        onNewBook={() => setShowNewBook(true)}
        onDeleteBook={deleteBook}
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
            {booksLoading ? (
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                color: "#78716C",
              }}>
                Loading…
              </div>
            ) : selectedBook ? (
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
            ) : null}
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
          {booksLoading ? (
            <EmptyState message="Loading your library…" />
          ) : !selectedBook ? (
            <EmptyState message="Select a book from the sidebar" />
          ) : selectedBook.chapters.length === 0 ? (
            <EmptyState message="No chapters yet — click Add chapter to get started" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 800 }}>
              {selectedBook.chapters.map((ch) => (
                <ChapterCard key={ch.id} chapter={ch} book={selectedBook} onDelete={deleteChapter} />
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
