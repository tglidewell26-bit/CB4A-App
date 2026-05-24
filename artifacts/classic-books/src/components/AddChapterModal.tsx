import { useState, useRef } from "react";
import type { Book } from "../types";
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

export interface NewChapterData {
  title: string;
  num?: number;
  pages: string;
  files?: File[];
}

interface AddChapterModalProps {
  book: Book;
  onClose: () => void;
  onSave: (chapter: NewChapterData) => Promise<void>;
}

export function AddChapterModal({ book, onClose, onSave }: AddChapterModalProps) {
  const [num, setNum] = useState("");
  const [title, setTitle] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSave = num && title.trim() && startPage && endPage;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) => /\.(pdf|docx|doc)$/i.test(f.name));
    if (valid.length === 0) return;
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existingNames.has(f.name))];
    });
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        num: Number(num),
        pages: `${startPage}–${endPage}`,
        files: files.length > 0 ? files : undefined,
      });
    } finally {
      setSaving(false);
    }
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
          Add lesson
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
            <Label>Lesson #</Label>
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
            <Label>Lesson Title</Label>
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

        <Label mt={14}>Chapter files</Label>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 11,
          color: "#A8967E",
          marginBottom: 6,
        }}>
          Upload one file per chapter — add multiple files if this lesson spans several chapters
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? "#92400E" : files.length > 0 ? "#059669" : "#D4C9B8"}`,
            borderRadius: 8,
            padding: files.length > 0 ? "12px 16px" : "20px 16px",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? "#FFF7ED" : files.length > 0 ? "#ECFDF5" : "#F8F6F1",
            transition: "all 0.15s ease",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            multiple
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />

          {files.length > 0 ? (
            <div>
              {/* File list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {files.map((f) => (
                  <div
                    key={f.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "white",
                      borderRadius: 5,
                      padding: "5px 10px",
                      border: "1px solid #6EE7B7",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ fontSize: 13, color: "#065F46" }}>✓</span>
                    <span style={{
                      flex: 1,
                      fontFamily: "'Source Sans 3', sans-serif",
                      fontSize: 12,
                      color: "#065F46",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {f.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6B7280",
                        fontSize: 12,
                        padding: "0 2px",
                        lineHeight: 1,
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 11,
                color: "#059669",
              }}>
                + Click or drop here to add more files
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>📎</div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#78716C" }}>
                Drop PDF or Word files here
              </div>
              <div style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 11,
                color: "#A8967E",
                marginTop: 2,
              }}>
                or click to browse · select multiple files for multi-chapter lessons
              </div>
            </div>
          )}
        </div>

        {files.length === 0 && (
          <div style={{
            fontFamily: "'Source Sans 3', sans-serif",
            fontSize: 11,
            color: "#D97706",
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            ⚠ Without a file, the lesson will be created but AI packets won't be generated
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "9px 20px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid #D4C9B8",
              color: "#78716C",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              padding: "9px 22px",
              borderRadius: 6,
              background: canSave && !saving ? "#92400E" : "#D4C9B8",
              border: "none",
              color: "white",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: canSave && !saving ? "pointer" : "default",
            }}
          >
            {saving ? "Uploading…" : files.length > 0 ? "Upload & Generate" : "Create lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}
