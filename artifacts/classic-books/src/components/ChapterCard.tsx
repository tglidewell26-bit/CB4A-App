import { useState } from "react";
import { GRADE_COLORS } from "../constants";
import type { Book, Chapter } from "../types";
import { ActionPill } from "./ActionPill";
import { EditChapterModal } from "./EditChapterModal";
import { getWorkbook, getTeacherGuide } from "@workspace/api-client-react";

interface ChapterCardProps {
  chapter: Chapter;
  book: Book;
  onDelete: (chapterId: number) => void;
  onRegenerate: (chapterId: number) => void;
  onEdit: (chapterId: number, data: { title: string; pages: string; num?: number | null }) => Promise<void>;
}

type LoadingState = "idle" | "loading" | "error";

export function ChapterCard({ chapter, book, onDelete, onRegenerate, onEdit }: ChapterCardProps) {
  const isReady = chapter.status === "ready";
  const isGenerating = chapter.status === "generating";
  const isError = chapter.status === "error";
  const gc = GRADE_COLORS[book.grade];

  const [workbookLoading, setWorkbookLoading] = useState<LoadingState>("idle");
  const [guideLoading, setGuideLoading] = useState<LoadingState>("idle");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const handleWorkbook = async () => {
    setWorkbookLoading("loading");
    try {
      const data = await getWorkbook(book.id, chapter.id) as { downloadUrl?: string };
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      }
      setWorkbookLoading("idle");
    } catch {
      setWorkbookLoading("error");
      setTimeout(() => setWorkbookLoading("idle"), 3000);
    }
  };

  const handleTeacherGuide = async () => {
    setGuideLoading("loading");
    try {
      const data = await getTeacherGuide(book.id, chapter.id) as { downloadUrl?: string };
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      }
      setGuideLoading("idle");
    } catch {
      setGuideLoading("error");
      setTimeout(() => setGuideLoading("idle"), 3000);
    }
  };

  const handleEditSave = async (data: { title: string; pages: string; num?: number | null }) => {
    setEditSaving(true);
    try {
      await onEdit(chapter.id, data);
      setShowEditModal(false);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      <div
        className="chapter-card"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E0D4",
          borderRadius: 10,
          padding: "18px 22px",
          borderLeft: `4px solid ${isReady ? "#92400E" : isGenerating ? "#FBBF24" : isError ? "#DC2626" : "#D4C9B8"}`,
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
                Chapter {chapter.num ?? chapter.id}
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
                  Generating…
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
              {isError && (
                <span style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 11,
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626", display: "inline-block" }} />
                  Generation failed
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

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{
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
            <button
              onClick={() => setShowEditModal(true)}
              title="Edit chapter"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "3px 5px",
                borderRadius: 4,
                color: "#C4B5A0",
                fontSize: 13,
                lineHeight: 1,
                transition: "color 0.15s ease, background 0.15s ease",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#92400E";
                (e.currentTarget as HTMLButtonElement).style.background = "#FEF3C7";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#C4B5A0";
                (e.currentTarget as HTMLButtonElement).style.background = "none";
              }}
            >
              ✎
            </button>
            <button
              onClick={() => onDelete(chapter.id)}
              title="Delete chapter"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "3px 5px",
                borderRadius: 4,
                color: "#C4B5A0",
                fontSize: 14,
                lineHeight: 1,
                transition: "color 0.15s ease, background 0.15s ease",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#DC2626";
                (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#C4B5A0";
                (e.currentTarget as HTMLButtonElement).style.background = "none";
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {isReady && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <ActionPill
              label={workbookLoading === "loading" ? "Loading…" : workbookLoading === "error" ? "Not available yet" : "Student workbook"}
              icon={workbookLoading === "loading" ? "⏳" : workbookLoading === "error" ? "⚠️" : "📄"}
              onClick={workbookLoading === "idle" ? handleWorkbook : undefined}
            />
            <ActionPill
              label={guideLoading === "loading" ? "Loading…" : guideLoading === "error" ? "Not available yet" : "Teacher guide"}
              icon={guideLoading === "loading" ? "⏳" : guideLoading === "error" ? "⚠️" : "📋"}
              onClick={guideLoading === "idle" ? handleTeacherGuide : undefined}
            />
            <ActionPill
              label="Regenerate"
              icon="↺"
              secondary
              onClick={() => onRegenerate(chapter.id)}
            />
          </div>
        )}
        {isError && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <ActionPill
              label="Retry generation"
              icon="↺"
              secondary
              onClick={() => onRegenerate(chapter.id)}
            />
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

      {showEditModal && (
        <EditChapterModal
          chapter={chapter}
          onClose={() => !editSaving && setShowEditModal(false)}
          onSave={handleEditSave}
          loading={editSaving}
        />
      )}
    </>
  );
}
