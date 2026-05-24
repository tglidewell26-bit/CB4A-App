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
  boxSizing: "border-box",
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "6px 8px",
  fontSize: 12,
};

export interface NewChapterData {
  title: string;
  num?: number;
  pages: string;
  file?: File;
}

interface ChapterRow {
  id: string;
  file: File;
  num: string;
  title: string;
  startPage: string;
  endPage: string;
}

interface AddChapterModalProps {
  book: Book;
  onClose: () => void;
  onSave: (chapters: NewChapterData[]) => Promise<void>;
}

function fileToTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
}

export function AddChapterModal({ book, onClose, onSave }: AddChapterModalProps) {
  const [rows, setRows] = useState<ChapterRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildRows = (files: File[]): ChapterRow[] =>
    files.map((f, i) => ({
      id: `${f.name}-${i}`,
      file: f,
      num: String(i + 1),
      title: fileToTitle(f),
      startPage: "",
      endPage: "",
    }));

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter(
      (f) => /\.(pdf|docx|doc)$/i.test(f.name),
    );
    if (arr.length === 0) return;
    setRows(buildRows(arr));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const updateRow = (id: string, field: keyof ChapterRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const canSave =
    rows.length > 0 &&
    rows.every((r) => r.num && r.title.trim() && r.startPage && r.endPage);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const chapters: NewChapterData[] = rows.map((r) => ({
        title: r.title.trim(),
        num: Number(r.num),
        pages: `${r.startPage}–${r.endPage}`,
        file: r.file,
      }));
      await onSave(chapters);
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = rows.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "28px 32px",
          width: rows.length > 1 ? 680 : 440,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4",
          transition: "width 0.2s ease",
        }}
      >
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 500,
          marginBottom: 4,
          color: "#1C1917",
        }}>
          Add {rows.length > 1 ? `${rows.length} chapters` : "chapter"}
        </div>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 12,
          color: "#78716C",
          marginBottom: 22,
        }}>
          {book.title} · Grade {book.grade}
        </div>

        {/* Drop zone — shown when empty or as a "replace" area */}
        {isEmpty && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragging ? "#92400E" : "#D4C9B8"}`,
                borderRadius: 8,
                padding: "36px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "#FFF7ED" : "#F8F6F1",
                transition: "all 0.15s ease",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.35 }}>📎</div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: "#57534E", fontWeight: 500 }}>
                Drop PDF or Word files here
              </div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#A8967E", marginTop: 4 }}>
                Select multiple files to add several chapters at once
              </div>
              <div style={{
                display: "inline-block",
                marginTop: 14,
                padding: "7px 18px",
                background: "#92400E",
                color: "white",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "'Source Sans 3', sans-serif",
                fontWeight: 500,
              }}>
                Browse files
              </div>
            </div>
          </>
        )}

        {/* File list with editable metadata */}
        {!isEmpty && (
          <>
            {/* Replace-files link */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#78716C" }}>
                Fill in the details for each chapter below.
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: "none", border: "none", fontSize: 12, color: "#92400E", cursor: "pointer", fontFamily: "'Source Sans 3', sans-serif", textDecoration: "underline", padding: 0 }}
              >
                Change files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {rows.length === 1 ? (
              /* Single-file layout: keep the familiar form */
              <SingleFileForm row={rows[0]} onUpdate={updateRow} />
            ) : (
              /* Multi-file layout: compact table */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((row, idx) => (
                  <MultiFileRow
                    key={row.id}
                    row={row}
                    index={idx}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                  />
                ))}
              </div>
            )}
          </>
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
              minWidth: 140,
            }}
          >
            {saving
              ? "Uploading…"
              : isEmpty
                ? "Select files first"
                : rows.length === 1
                  ? "Upload & Generate"
                  : `Upload ${rows.length} chapters`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleFileForm({
  row,
  onUpdate,
}: {
  row: ChapterRow;
  onUpdate: (id: string, field: keyof ChapterRow, value: string) => void;
}) {
  return (
    <>
      {/* File badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#ECFDF5",
        border: "1px solid #6EE7B7",
        borderRadius: 6,
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#065F46", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.file.name}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 80 }}>
          <Label>Lesson #</Label>
          <input
            type="number"
            min="1"
            value={row.num}
            onChange={(e) => onUpdate(row.id, "num", e.target.value)}
            placeholder="1"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Label>Lesson Title</Label>
          <input
            value={row.title}
            onChange={(e) => onUpdate(row.id, "title", e.target.value)}
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
          value={row.startPage}
          onChange={(e) => onUpdate(row.id, "startPage", e.target.value)}
          placeholder="Start"
          style={{ ...inputStyle, width: "45%" }}
        />
        <span style={{ color: "#A8967E", fontFamily: "'Source Sans 3', sans-serif" }}>to</span>
        <input
          type="number"
          min="1"
          value={row.endPage}
          onChange={(e) => onUpdate(row.id, "endPage", e.target.value)}
          placeholder="End"
          style={{ ...inputStyle, width: "45%" }}
        />
      </div>
    </>
  );
}

function MultiFileRow({
  row,
  index,
  onUpdate,
  onRemove,
}: {
  row: ChapterRow;
  index: number;
  onUpdate: (id: string, field: keyof ChapterRow, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "52px 1fr 68px 68px 28px",
      gap: 8,
      alignItems: "end",
      padding: "10px 12px",
      background: "#F8F6F1",
      borderRadius: 8,
      border: "1px solid #E8E0D4",
    }}>
      <div>
        {index === 0 && <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: "#A8967E", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Lesson #</div>}
        <input
          type="number"
          min="1"
          value={row.num}
          onChange={(e) => onUpdate(row.id, "num", e.target.value)}
          placeholder="#"
          style={smallInputStyle}
        />
      </div>
      <div>
        {index === 0 && <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: "#A8967E", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Title · {row.file.name}</div>}
        {index !== 0 && <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: "#A8967E", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.file.name}</div>}
        <input
          value={row.title}
          onChange={(e) => onUpdate(row.id, "title", e.target.value)}
          placeholder="Lesson title"
          style={smallInputStyle}
        />
      </div>
      <div>
        {index === 0 && <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: "#A8967E", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Start pg</div>}
        <input
          type="number"
          min="1"
          value={row.startPage}
          onChange={(e) => onUpdate(row.id, "startPage", e.target.value)}
          placeholder="1"
          style={smallInputStyle}
        />
      </div>
      <div>
        {index === 0 && <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 10, color: "#A8967E", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>End pg</div>}
        <input
          type="number"
          min="1"
          value={row.endPage}
          onChange={(e) => onUpdate(row.id, "endPage", e.target.value)}
          placeholder="20"
          style={smallInputStyle}
        />
      </div>
      <div style={{ paddingBottom: 1 }}>
        {index === 0 && <div style={{ marginBottom: 4, height: 14 }} />}
        <button
          onClick={() => onRemove(row.id)}
          title="Remove this file"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#D97706",
            fontSize: 14,
            padding: "6px 4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
