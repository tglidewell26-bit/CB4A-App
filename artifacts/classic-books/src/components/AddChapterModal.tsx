import { useState } from "react";
import type { Book, Chapter } from "../types";
import { Label } from "./Label";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: "1px solid #D4C9B8",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "'Source Sans 3', sans-serif",
  background: "#FAFAF8",
  color: "#1C1917",
};

interface AddChapterModalProps {
  book: Book;
  onClose: () => void;
  onSave: (chapter: Omit<Chapter, "id" | "status">) => void;
}

export function AddChapterModal({ book, onClose, onSave }: AddChapterModalProps) {
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const canSave = num && title.trim() && startPage && endPage && file;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSave = () => {
    if (!canSave || !file) return;
    onSave({
      title: title.trim(),
      num: Number(num),
      pages: `${startPage}–${endPage}`,
      file: file.name,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "28px 32px",
          width: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4",
        }}
      >
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 500,
          marginBottom: 4,
          color: "#1C1917",
        }}>
          Add chapter
        </div>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 12,
          color: "#78716C",
          marginBottom: 22,
        }}>
          {book.title} · Grade {book.grade}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 80 }}>
            <Label>Chapter #</Label>
            <input
              type="number"
              min="1"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="1"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Chapter title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Going Up to the Alm-Uncle"
              style={inputStyle}
            />
          </div>
        </div>

        <Label mt={14}>Page range</Label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="number"
            min="1"
            value={startPage}
            onChange={(e) => setStartPage(e.target.value)}
            placeholder="Start"
            style={{ ...inputStyle, width: "45%" }}
          />
          <span style={{ color: "#A8967E", fontFamily: "'Source Sans 3', sans-serif" }}>to</span>
          <input
            type="number"
            min="1"
            value={endPage}
            onChange={(e) => setEndPage(e.target.value)}
            placeholder="End"
            style={{ ...inputStyle, width: "45%" }}
          />
        </div>

        <Label mt={14}>Upload chapter file</Label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          style={{
            border: `1.5px dashed ${dragging ? "#92400E" : file ? "#059669" : "#D4C9B8"}`,
            borderRadius: 8,
            padding: "20px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? "#FFF7ED" : file ? "#ECFDF5" : "#F8F6F1",
            transition: "all 0.15s ease",
          }}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx,.doc"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />
          {file ? (
            <div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                color: "#065F46",
                fontWeight: 500,
              }}>
                {file.name}
              </div>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 11,
                color: "#78716C",
                marginTop: 2,
              }}>
                Click to change file
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>📎</div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#78716C" }}>
                Drop PDF or Word file here
              </div>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 11,
                color: "#A8967E",
                marginTop: 2,
              }}>
                or click to browse
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid #D4C9B8",
              color: "#78716C",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "9px 22px",
              borderRadius: 6,
              background: canSave ? "#92400E" : "#D4C9B8",
              border: "none",
              color: "white",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: canSave ? "pointer" : "default",
            }}
          >
            Generate packets
          </button>
        </div>
      </div>
    </div>
  );
}
