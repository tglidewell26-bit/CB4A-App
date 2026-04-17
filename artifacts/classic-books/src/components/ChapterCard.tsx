import { GRADE_COLORS } from "../constants";
import type { Book, Chapter } from "../types";
import { ActionPill } from "./ActionPill";

interface ChapterCardProps {
  chapter: Chapter;
  book: Book;
}

export function ChapterCard({ chapter, book }: ChapterCardProps) {
  const isReady = chapter.status === "ready";
  const isGenerating = chapter.status === "generating";
  const gc = GRADE_COLORS[book.grade];

  return (
    <div
      className="chapter-card"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E0D4",
        borderRadius: 10,
        padding: "18px 22px",
        borderLeft: `4px solid ${isReady ? "#92400E" : isGenerating ? "#FBBF24" : "#D4C9B8"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: "#A8967E",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              Chapter {chapter.id}
            </span>
            {isGenerating && (
              <span
                className="pulse"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 11,
                  color: "#D97706",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", display: "inline-block" }} />
                Generating...
              </span>
            )}
            {isReady && (
              <span style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 11,
                color: "#065F46",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                Ready
              </span>
            )}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 16,
            fontWeight: 500,
            color: "#1C1917",
            marginBottom: 4,
          }}>
            {chapter.title}
          </div>
          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#78716C" }}>
            Pages {chapter.pages}
            {chapter.date && ` · Generated ${chapter.date}`}
          </div>
        </div>

        <div style={{
          flexShrink: 0,
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "'Source Sans 3', sans-serif",
          background: gc.bg,
          color: gc.text,
          border: `1px solid ${gc.border}`,
        }}>
          Gr {book.grade}
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
            height: 4,
            background: "#F5F0E8",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: "60%",
              background: "#D97706",
              borderRadius: 2,
              animation: "progress 1.5s ease-in-out infinite",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
