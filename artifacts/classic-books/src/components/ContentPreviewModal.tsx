import ReactMarkdown from "react-markdown";

interface ContentPreviewModalProps {
  markdown: string;
  title: string;
  filename: string;
  onClose: () => void;
}

const LEGACY_HTML_STYLES = `
  body { font-family: 'Georgia', serif; color: #1C1917; background: #fff; }
  .workbook, .teacher-guide { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
  .wb-title, .tg-title { font-size: 28px; font-weight: 600; margin-bottom: 4px; color: #1C1917; }
  .wb-meta, .tg-meta { color: #78716C; font-size: 13px; margin-bottom: 32px; font-style: italic; }
  .wb-section, .tg-section { margin-bottom: 36px; border-top: 2px solid #E8E0D4; padding-top: 20px; }
  .wb-section h2, .tg-section h2 { font-size: 18px; font-weight: 600; color: #92400E; margin-bottom: 10px; }
  .wb-instructions, .tg-instructions { color: #78716C; font-size: 13px; margin-bottom: 12px; font-style: italic; }
  .focus-question { background: #FEF7ED; border-left: 4px solid #92400E; padding: 14px 18px; border-radius: 0 6px 6px 0; }
  .vocab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .vocab-item { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px; }
  .vocab-word { font-size: 15px; font-weight: 700; color: #92400E; margin-bottom: 6px; }
  .vocab-quote { font-size: 12px; color: #78716C; margin-bottom: 6px; line-height: 1.5; }
  .vocab-def, .vocab-example { font-size: 13px; margin-bottom: 4px; }
  .question-list { padding-left: 18px; }
  .question-item { margin-bottom: 18px; }
  .question { font-weight: 500; margin-bottom: 6px; }
  .answer-space { border-bottom: 1px solid #D4C9B8; height: 60px; margin-top: 6px; }
  .mc-list { padding-left: 18px; }
  .mc-item { margin-bottom: 18px; }
  .mc-options { list-style: none; padding-left: 8px; margin-top: 6px; }
  .mc-options li { margin-bottom: 4px; font-size: 13px; }
  .hints { list-style: disc; padding-left: 20px; color: #78716C; font-size: 13px; margin-bottom: 12px; }
  .writing-space { border: 1px dashed #D4C9B8; min-height: 120px; border-radius: 6px; margin-top: 8px; }
  .timeline-list { padding-left: 18px; }
  .timeline-list li { margin-bottom: 8px; }
  .vocab-entry { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
  .answer-list { padding-left: 18px; }
  .answer-item { margin-bottom: 18px; }
  .answer { color: #065F46; font-size: 13px; margin-top: 4px; }
  .discussion-note { color: #92400E; font-size: 12px; margin-top: 4px; }
  .diff-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .diff-card { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px; }
  .diff-card h3 { font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 8px; }
  .rubric-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rubric-table th, .rubric-table td { border: 1px solid #E8E0D4; padding: 8px 12px; text-align: left; }
  .rubric-table th { background: #F8F6F1; font-weight: 600; }
  @media print { body { margin: 0; } }
`;

function isLegacyHtml(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith("<div") || trimmed.startsWith("```html");
}

function stripCodeFence(content: string): string {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("```html")) {
    return trimmed.replace(/^```html\s*/, "").replace(/\s*```\s*$/, "");
  }
  return content;
}

export function ContentPreviewModal({ markdown, title, filename, onClose }: ContentPreviewModalProps) {
  const legacy = isLegacyHtml(markdown);

  const displayContent = legacy ? stripCodeFence(markdown) : markdown;

  const handleDownload = () => {
    const ext = legacy ? "html" : "md";
    const mime = legacy ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8";
    const blob = new Blob([displayContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.\w+$/, "") + "." + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintLegacy = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${LEGACY_HTML_STYLES}</style></head><body>${displayContent}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ alignItems: "flex-start", paddingTop: 32, paddingBottom: 32, overflowY: "auto" }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          width: "min(860px, 95vw)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
        }}
      >
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid #E8E0D4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 500, color: "#1C1917" }}>
            {title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {legacy && (
              <button
                onClick={handlePrintLegacy}
                style={{
                  padding: "8px 16px",
                  background: "#92400E",
                  border: "none",
                  borderRadius: 6,
                  color: "white",
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                🖨 Print / Download PDF
              </button>
            )}
            <button
              onClick={handleDownload}
              style={{
                padding: "8px 16px",
                background: legacy ? "none" : "#92400E",
                border: legacy ? "1px solid #D4C9B8" : "none",
                borderRadius: 6,
                color: legacy ? "#78716C" : "white",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {legacy ? "Download HTML" : "Download as Markdown"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "1px solid #D4C9B8",
                borderRadius: 6,
                padding: "7px 14px",
                color: "#78716C",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
          {legacy ? (
            <div dangerouslySetInnerHTML={{ __html: `<style>${LEGACY_HTML_STYLES}</style>${displayContent}` }} />
          ) : (
            <article className="prose prose-stone max-w-none">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
