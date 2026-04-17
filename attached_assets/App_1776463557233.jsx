import { useState, useEffect } from "react";

const GRADE_STANDARDS = {
  3: ["RL.3.1", "RL.3.3", "RL.3.4", "L.3.4", "L.3.5", "W.3.3", "SL.3.1"],
  4: ["RL.4.1", "RL.4.3", "RL.4.4", "L.4.4", "L.4.5", "W.4.3", "SL.4.1"],
  5: ["RL.5.1", "RL.5.3", "RL.5.4", "L.5.4", "L.5.5", "W.5.3", "RI.5.1"],
  6: ["RL.6.1", "RL.6.3", "RL.6.4", "L.6.4", "L.6.5", "W.6.3", "RI.6.1"],
  7: ["RL.7.1", "RL.7.3", "RL.7.4", "L.7.4", "L.7.5", "W.7.3", "RI.7.1"],
  8: ["RL.8.1", "RL.8.3", "RL.8.4", "L.8.4", "L.8.5", "W.8.3", "RI.8.1"],
};

const KNOWN_AUTHORS = {
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

const SAMPLE_BOOKS = [
  { id: 1, title: "Heidi", author: "Johanna Spyri", grade: 3, chapters: [
    { id: 1, title: "Going Up to the Alm-Uncle", pages: "1–13", status: "ready", date: "Apr 5, 2026" },
    { id: 2, title: "At the Grandfather's", pages: "14–26", status: "ready", date: "Apr 5, 2026" },
    { id: 3, title: "On the Pasture", pages: "27–38", status: "generating" },
  ]},
  { id: 2, title: "Treasure Island", author: "Robert Louis Stevenson", grade: 5, chapters: [
    { id: 1, title: "The Old Sea-Dog at the Admiral Benbow", pages: "1–11", status: "ready", date: "Mar 28, 2026" },
  ]},
  { id: 3, title: "The Call of the Wild", author: "Jack London", grade: 7, chapters: [] },
];

const GRADE_COLORS = {
  3: { bg: "#FFF7ED", border: "#FB923C", text: "#C2410C" },
  4: { bg: "#FEF3C7", border: "#FBBF24", text: "#B45309" },
  5: { bg: "#ECFDF5", border: "#34D399", text: "#065F46" },
  6: { bg: "#EFF6FF", border: "#60A5FA", text: "#1D4ED8" },
  7: { bg: "#F5F3FF", border: "#A78BFA", text: "#5B21B6" },
  8: { bg: "#FDF2F8", border: "#F472B6", text: "#9D174D" },
};

export default function App() {
  const [books, setBooks] = useState(SAMPLE_BOOKS);
  const [selectedBook, setSelectedBook] = useState(SAMPLE_BOOKS[0]);
  const [showNewBook, setShowNewBook] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleBookSelect = (book) => {
    setSelectedBook(book);
  };

  const addBook = (book) => {
    const newBook = { ...book, id: Date.now(), chapters: [] };
    setBooks(prev => [...prev, newBook]);
    setSelectedBook(newBook);
    setShowNewBook(false);
  };

  const addChapter = (chapter) => {
    const newChapter = { ...chapter, id: Date.now(), status: "generating" };
    setBooks(prev => prev.map(b =>
      b.id === selectedBook.id
        ? { ...b, chapters: [...b.chapters, newChapter] }
        : b
    ));
    setSelectedBook(prev => ({ ...prev, chapters: [...prev.chapters, newChapter] }));
    setShowAddChapter(false);
  };

  return (
    <div style={{
      display: "flex", height: "100vh", fontFamily: "'Georgia', serif",
      background: "#F8F6F1", color: "#1C1917", overflow: "hidden"
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
        .action-pill:hover { background: #92400E !important; color: white !important; }
        .tag-pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; font-family: 'Source Sans 3', sans-serif; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; margin: 2px 2px 2px 0; }
        input:focus, select:focus { outline: none; border-color: #92400E !important; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
        .fade-in { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .chapter-card { transition: all 0.15s ease; }
        .btn-primary, .btn-secondary, .action-pill { transition: all 0.15s ease; cursor: pointer; }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
        background: "#1C1917", display: "flex", flexDirection: "column",
        transition: "all 0.25s ease", overflow: "hidden", flexShrink: 0
      }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #2C2824" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: "#F5F0E8", letterSpacing: "0.01em" }}>
            Classic Books
          </div>
          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#A8967E", marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Curriculum Generator
          </div>
        </div>

        <div style={{ padding: "12px 12px 8px" }}>
          <button
            className="btn-primary"
            onClick={() => setShowNewBook(true)}
            style={{
              width: "100%", padding: "9px 14px", background: "#92400E",
              border: "none", borderRadius: 6, color: "white",
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8
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
                onClick={() => handleBookSelect(book)}
                style={{
                  padding: "12px 20px", cursor: "pointer",
                  borderLeft: isActive ? "3px solid #92400E" : "3px solid transparent",
                  background: isActive ? "#FFFFFF08" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 500,
                    color: isActive ? "#F5F0E8" : "#C4B5A0"
                  }}>{book.title}</span>
                  <span style={{
                    padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                    fontFamily: "'Source Sans 3', sans-serif",
                    background: gc.bg, color: gc.text, border: `1px solid ${gc.border}`
                  }}>Gr {book.grade}</span>
                </div>
                <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#6B5D4E" }}>
                  {book.author} · {book.chapters.length} {book.chapters.length === 1 ? "chapter" : "chapters"}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #2C2824" }}>
          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#4A3F34", textAlign: "center" }}>
            classicbooksforall.com
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{
          padding: "16px 28px", background: "#FFFFFF",
          borderBottom: "1px solid #E8E0D4",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setSidebarOpen(p => !p)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#78716C" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor"/>
                <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor"/>
                <rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor"/>
              </svg>
            </button>
            {selectedBook && (
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, color: "#1C1917" }}>
                  {selectedBook.title}
                </div>
                <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#78716C", marginTop: 1 }}>
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
                padding: "8px 18px", background: "#92400E", border: "none",
                borderRadius: 6, color: "white",
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 7
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
              {selectedBook.chapters.map(ch => (
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

function ChapterCard({ chapter, book }) {
  const isReady = chapter.status === "ready";
  const isGenerating = chapter.status === "generating";
  const gc = GRADE_COLORS[book.grade];

  return (
    <div className="chapter-card" style={{
      background: "#FFFFFF", border: "1px solid #E8E0D4",
      borderRadius: 10, padding: "18px 22px",
      borderLeft: `4px solid ${isReady ? "#92400E" : isGenerating ? "#FBBF24" : "#D4C9B8"}`
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, fontWeight: 600,
              color: "#A8967E", textTransform: "uppercase", letterSpacing: "0.06em"
            }}>Chapter {chapter.id}</span>
            {isGenerating && (
              <span className="pulse" style={{
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 11,
                color: "#D97706", display: "flex", alignItems: "center", gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", display: "inline-block" }}></span>
                Generating...
              </span>
            )}
            {isReady && (
              <span style={{
                fontFamily: "'Source Sans 3', sans-serif", fontSize: 11,
                color: "#065F46", display: "flex", alignItems: "center", gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }}></span>
                Ready
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 500, color: "#1C1917", marginBottom: 4 }}>
            {chapter.title}
          </div>
          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#78716C" }}>
            Pages {chapter.pages}
            {chapter.date && ` · Generated ${chapter.date}`}
          </div>
        </div>
      </div>

      {isReady && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <ActionPill label="Student workbook" icon="📄" />
          <ActionPill label="Teacher guide" icon="📋" />
          <ActionPill label="Regenerate" icon="↺" secondary />
        </div>
      )}
      {isGenerating && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            height: 4, background: "#F5F0E8", borderRadius: 2, overflow: "hidden"
          }}>
            <div style={{
              height: "100%", width: "60%", background: "#D97706", borderRadius: 2,
              animation: "progress 1.5s ease-in-out infinite"
            }}></div>
          </div>
          <style>{`@keyframes progress { 0% { width: 20%; } 50% { width: 80%; } 100% { width: 20%; } }`}</style>
        </div>
      )}
    </div>
  );
}

function ActionPill({ label, icon, secondary }) {
  return (
    <button className="action-pill" style={{
      padding: "6px 14px", borderRadius: 20,
      background: secondary ? "transparent" : "#92400E",
      border: secondary ? "1px solid #D4C9B8" : "none",
      color: secondary ? "#78716C" : "white",
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 5, cursor: "pointer"
    }}>
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      {label}
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: 300, color: "#A8967E", textAlign: "center"
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📚</div>
      <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: "#78716C" }}>{message}</div>
    </div>
  );
}

function NewBookModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [grade, setGrade] = useState("");
  const [lookupState, setLookupState] = useState("idle"); // idle | searching | found | notfound
  const [confirmed, setConfirmed] = useState(false);

  const lookup = () => {
    if (!title.trim()) return;
    setLookupState("searching");
    setAuthor("");
    setConfirmed(false);
    setTimeout(() => {
      const match = KNOWN_AUTHORS[title.trim().toLowerCase()];
      if (match) {
        setAuthor(match);
        setLookupState("found");
        setConfirmed(true);
      } else {
        setLookupState("notfound");
      }
    }, 1100);
  };

  const canSave = title.trim() && author.trim() && grade;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 12, padding: "28px 32px",
          width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4"
        }}
      >
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, marginBottom: 22, color: "#1C1917" }}>
          New book folder
        </div>

        <Label>Book title</Label>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setLookupState("idle"); setConfirmed(false); }}
          placeholder="e.g. The Secret Garden"
          style={inputStyle}
        />

        <Label mt={16}>Author</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={author}
            onChange={e => { setAuthor(e.target.value); setConfirmed(false); }}
            placeholder={lookupState === "searching" ? "Searching..." : "Enter title above, then look up"}
            disabled={lookupState === "searching"}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={lookup}
            disabled={!title.trim() || lookupState === "searching"}
            style={{
              padding: "0 16px", height: 38, borderRadius: 6,
              background: lookupState === "searching" ? "#F5F0E8" : "#1C1917",
              border: "none", color: lookupState === "searching" ? "#A8967E" : "white",
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 500,
              cursor: lookupState === "searching" ? "default" : "pointer", whiteSpace: "nowrap",
              opacity: !title.trim() ? 0.5 : 1
            }}
          >
            {lookupState === "searching" ? "..." : "Look up"}
          </button>
        </div>

        {lookupState === "found" && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#065F46", fontFamily: "'Source Sans 3', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            <span>✓</span> Found via web search — edit above if incorrect
          </div>
        )}
        {lookupState === "notfound" && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#B45309", fontFamily: "'Source Sans 3', sans-serif" }}>
            Not found automatically — please enter manually
          </div>
        )}

        <Label mt={16}>Grade level</Label>
        <select
          value={grade}
          onChange={e => setGrade(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">Select grade...</option>
          {[3,4,5,6,7,8].map(g => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>

        {grade && (
          <div style={{
            marginTop: 12, padding: "10px 14px", background: "#F8F6F1",
            borderRadius: 6, border: "1px solid #E8E0D4"
          }}>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#78716C", marginBottom: 6 }}>
              California Common Core standards for Grade {grade}:
            </div>
            <div>
              {GRADE_STANDARDS[+grade]?.map(s => (
                <span key={s} className="tag-pill">{s}</span>
              ))}
              <span className="tag-pill" style={{ background: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Student workbook</span>
              <span className="tag-pill" style={{ background: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Teacher guide</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 6, background: "transparent",
            border: "1px solid #D4C9B8", color: "#78716C",
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, cursor: "pointer"
          }}>Cancel</button>
          <button
            onClick={() => canSave && onSave({ title: title.trim(), author: author.trim(), grade: +grade })}
            disabled={!canSave}
            style={{
              padding: "9px 22px", borderRadius: 6,
              background: canSave ? "#92400E" : "#D4C9B8",
              border: "none", color: "white",
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, fontWeight: 500,
              cursor: canSave ? "pointer" : "default"
            }}
          >Create folder</button>
        </div>
      </div>
    </div>
  );
}

function AddChapterModal({ book, onClose, onSave }) {
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const canSave = num && title.trim() && startPage && endPage && file;

  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 12, padding: "28px 32px",
          width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4"
        }}
      >
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, marginBottom: 4, color: "#1C1917" }}>
          Add chapter
        </div>
        <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#78716C", marginBottom: 22 }}>
          {book.title} · Grade {book.grade}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 80 }}>
            <Label>Chapter #</Label>
            <input
              type="number" min="1" value={num}
              onChange={e => setNum(e.target.value)}
              placeholder="1"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Chapter title</Label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Going Up to the Alm-Uncle"
              style={inputStyle}
            />
          </div>
        </div>

        <Label mt={14}>Page range</Label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="number" min="1" value={startPage}
            onChange={e => setStartPage(e.target.value)}
            placeholder="Start"
            style={{ ...inputStyle, width: "45%" }}
          />
          <span style={{ color: "#A8967E", fontFamily: "'Source Sans 3', sans-serif" }}>to</span>
          <input
            type="number" min="1" value={endPage}
            onChange={e => setEndPage(e.target.value)}
            placeholder="End"
            style={{ ...inputStyle, width: "45%" }}
          />
        </div>

        <Label mt={14}>Upload chapter file</Label>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input").click()}
          style={{
            border: `1.5px dashed ${dragging ? "#92400E" : file ? "#059669" : "#D4C9B8"}`,
            borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer",
            background: dragging ? "#FFF7ED" : file ? "#ECFDF5" : "#F8F6F1",
            transition: "all 0.15s ease"
          }}
        >
          <input
            id="file-input" type="file" accept=".pdf,.docx,.doc"
            style={{ display: "none" }}
            onChange={e => setFile(e.target.files[0])}
          />
          {file ? (
            <div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                {file.name}
              </div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#78716C", marginTop: 2 }}>
                Click to change file
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>📎</div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#78716C" }}>
                Drop PDF or Word file here
              </div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#A8967E", marginTop: 2 }}>
                or click to browse
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 6, background: "transparent",
            border: "1px solid #D4C9B8", color: "#78716C",
            fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, cursor: "pointer"
          }}>Cancel</button>
          <button
            onClick={() => canSave && onSave({
              title: title.trim(),
              num: +num,
              pages: `${startPage}–${endPage}`,
              file: file.name
            })}
            disabled={!canSave}
            style={{
              padding: "9px 22px", borderRadius: 6,
              background: canSave ? "#92400E" : "#D4C9B8",
              border: "none", color: "white",
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, fontWeight: 500,
              cursor: canSave ? "pointer" : "default"
            }}
          >Generate packets</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, mt }) {
  return (
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, fontWeight: 600,
      color: "#78716C", textTransform: "uppercase", letterSpacing: "0.06em",
      marginBottom: 5, marginTop: mt || 0
    }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 11px", border: "1px solid #D4C9B8",
  borderRadius: 6, fontSize: 13, fontFamily: "'Source Sans 3', sans-serif",
  background: "#FAFAF8", color: "#1C1917"
};
