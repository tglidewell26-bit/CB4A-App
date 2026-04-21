import ReactMarkdown from "react-markdown";

interface ContentPreviewModalProps {
  markdown: string;
  title: string;
  filename: string;
  onClose: () => void;
}

export function ContentPreviewModal({ markdown, title, filename, onClose }: ContentPreviewModalProps) {
  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
            <button
              onClick={handleDownloadMarkdown}
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
              Download as Markdown
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
          <article className="prose prose-stone max-w-none">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
