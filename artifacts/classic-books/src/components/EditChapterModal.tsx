import { useState } from "react";
import type { Chapter } from "../types";
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

interface EditChapterModalProps {
  chapter: Chapter;
  onClose: () => void;
  onSave: (data: { title: string; pages: string; num?: number | null }) => void;
  loading?: boolean;
}

export function EditChapterModal({ chapter, onClose, onSave, loading = false }: EditChapterModalProps) {
  const [title, setTitle] = useState(chapter.title);
  const [pages, setPages] = useState(chapter.pages);
  const [numStr, setNumStr] = useState(chapter.num !== undefined ? String(chapter.num) : "");

  const titleTrimmed = title.trim();
  const pagesTrimmed = pages.trim();
  const numVal = numStr.trim() === "" ? null : Number(numStr.trim());
  const numValid = numStr.trim() === "" || (Number.isInteger(numVal) && (numVal as number) >= 1);

  const canSave = titleTrimmed && pagesTrimmed && numValid && !loading;

  const originalNum = chapter.num !== undefined ? chapter.num : null;
  const hasChanges =
    titleTrimmed !== chapter.title ||
    pagesTrimmed !== chapter.pages ||
    numVal !== originalNum;

  const handleSave = () => {
    if (!canSave || !hasChanges) return;
    onSave({
      title: titleTrimmed,
      pages: pagesTrimmed,
      num: numVal,
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
          width: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4",
        }}
      >
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 500,
          marginBottom: 22,
          color: "#1C1917",
        }}>
          Edit chapter
        </div>

        <Label>Lesson Title</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Valley of Ashes"
          style={inputStyle}
          autoFocus
        />

        <Label mt={16}>Page range</Label>
        <input
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          placeholder="e.g. 1–24"
          style={inputStyle}
        />

        <Label mt={16}>Lesson # <span style={{ color: "#A8967E", fontWeight: 400 }}>(optional)</span></Label>
        <input
          value={numStr}
          onChange={(e) => setNumStr(e.target.value)}
          placeholder="e.g. 1"
          type="number"
          min={1}
          style={{
            ...inputStyle,
            borderColor: !numValid ? "#DC2626" : "#D4C9B8",
          }}
        />
        {!numValid && (
          <div style={{
            marginTop: 4,
            fontSize: 12,
            color: "#DC2626",
            fontFamily: "'Source Sans 3', sans-serif",
          }}>
            Must be a positive whole number
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={loading}
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
            disabled={!canSave || !hasChanges}
            style={{
              padding: "9px 22px",
              borderRadius: 6,
              background: canSave && hasChanges ? "#92400E" : "#D4C9B8",
              border: "none",
              color: "white",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: canSave && hasChanges ? "pointer" : "default",
            }}
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
