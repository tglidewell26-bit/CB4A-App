import { useState } from "react";
import { KNOWN_AUTHORS, GRADE_STANDARDS } from "../constants";
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

interface NewBookModalProps {
  onClose: () => void;
  onSave: (book: Omit<Book, "id" | "chapters">) => void;
}

type LookupState = "idle" | "searching" | "found" | "notfound";

export function NewBookModal({ onClose, onSave }: NewBookModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");

  const lookup = () => {
    if (!title.trim()) return;
    setLookupState("searching");
    setAuthor("");
    setTimeout(() => {
      const match = KNOWN_AUTHORS[title.trim().toLowerCase()];
      if (match) {
        setAuthor(match);
        setLookupState("found");
      } else {
        setLookupState("notfound");
      }
    }, 1100);
  };

  const canSave = title.trim() && author.trim() && grade;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ title: title.trim(), author: author.trim(), grade: Number(grade) as Book["grade"] });
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
          New book folder
        </div>

        <Label>Book title</Label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setLookupState("idle");
          }}
          placeholder="e.g. The Secret Garden"
          style={inputStyle}
        />

        <Label mt={16}>Author</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={lookupState === "searching" ? "Searching..." : "Enter title above, then look up"}
            disabled={lookupState === "searching"}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={lookup}
            disabled={!title.trim() || lookupState === "searching"}
            style={{
              padding: "0 16px",
              height: 38,
              borderRadius: 6,
              background: lookupState === "searching" ? "#F5F0E8" : "#1C1917",
              border: "none",
              color: lookupState === "searching" ? "#A8967E" : "white",
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: lookupState === "searching" || !title.trim() ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: !title.trim() ? 0.5 : 1,
            }}
          >
            {lookupState === "searching" ? "..." : "Look up"}
          </button>
        </div>

        {lookupState === "found" && (
          <div style={{
            marginTop: 6,
            fontSize: 12,
            color: "#065F46",
            fontFamily: "'Source Sans 3', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}>
            <span>✓</span> Found — edit above if incorrect
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
          onChange={(e) => setGrade(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">Select grade...</option>
          {[3, 4, 5, 6, 7, 8].map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>

        {grade && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#F8F6F1",
            borderRadius: 6,
            border: "1px solid #E8E0D4",
          }}>
            <div style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 11,
              color: "#78716C",
              marginBottom: 6,
            }}>
              California Common Core standards for Grade {grade}:
            </div>
            <div>
              {GRADE_STANDARDS[Number(grade)]?.map((s) => (
                <span key={s} className="tag-pill">{s}</span>
              ))}
              <span className="tag-pill" style={{ background: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>
                Student workbook
              </span>
              <span className="tag-pill" style={{ background: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>
                Teacher guide
              </span>
            </div>
          </div>
        )}

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
            Create folder
          </button>
        </div>
      </div>
    </div>
  );
}
