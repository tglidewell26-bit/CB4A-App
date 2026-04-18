interface ContentPreviewModalProps {
  html: string;
  title: string;
  onClose: () => void;
}

const WORKBOOK_STYLES = `
  body { font-family: 'Georgia', serif; color: #1C1917; background: #fff; }
  .workbook, .teacher-guide { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
  .wb-title, .tg-title { font-size: 28px; font-weight: 600; margin-bottom: 4px; color: #1C1917; }
  .wb-meta, .tg-meta { color: #78716C; font-size: 13px; margin-bottom: 32px; font-style: italic; }
  .wb-section, .tg-section { margin-bottom: 36px; border-top: 2px solid #E8E0D4; padding-top: 20px; }
  .wb-section h2, .tg-section h2 { font-size: 18px; font-weight: 600; color: #92400E; margin-bottom: 10px; }
  .wb-instructions, .tg-instructions { color: #78716C; font-size: 13px; margin-bottom: 12px; font-style: italic; }
  .focus-question { background: #FEF7ED; border-left: 4px solid #92400E; padding: 14px 18px; border-radius: 0 6px 6px 0; }
  .focus-question .wb-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #92400E; margin-bottom: 4px; }
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
  .creative-prompt { font-weight: 500; color: #1C1917; font-style: normal !important; }
  .writing-space { border: 1px dashed #D4C9B8; min-height: 120px; border-radius: 6px; margin-top: 8px; }
  .timeline-list { padding-left: 18px; }
  .timeline-list li { margin-bottom: 8px; }
  .prediction-stem { font-size: 15px; font-style: italic; color: #78716C; border-left: 3px solid #D4C9B8; padding-left: 14px; }
  /* Teacher guide specific */
  .vocab-entry { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
  .answer-list { padding-left: 18px; }
  .answer-item { margin-bottom: 18px; }
  .answer { color: #065F46; font-size: 13px; margin-top: 4px; }
  .discussion-note { color: #92400E; font-size: 12px; margin-top: 4px; }
  .objectives-list { padding-left: 18px; }
  .objectives-list li { margin-bottom: 6px; font-size: 13px; }
  .discussion-list { padding-left: 18px; }
  .discussion-item { margin-bottom: 20px; }
  .guiding-points { color: #78716C; font-size: 12px; margin-top: 4px; }
  .diff-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .diff-card { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 14px; }
  .diff-card h3 { font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 8px; }
  .diff-card ul { padding-left: 16px; }
  .diff-card li { font-size: 12px; margin-bottom: 4px; }
  .extension-list { padding-left: 18px; }
  .extension-list li { margin-bottom: 8px; font-size: 13px; }
  .mc-answers { padding-left: 18px; }
  .mc-answers li { margin-bottom: 6px; font-size: 13px; }
  .rubric-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rubric-table th, .rubric-table td { border: 1px solid #E8E0D4; padding: 8px 12px; text-align: left; }
  .rubric-table th { background: #F8F6F1; font-weight: 600; }
  @media print {
    body { margin: 0; }
    .workbook, .teacher-guide { padding: 16px; }
  }
`;

export function ContentPreviewModal({ html, title, onClose }: ContentPreviewModalProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${WORKBOOK_STYLES}</style></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
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
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 18,
            fontWeight: 500,
            color: "#1C1917",
          }}>
            {title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handlePrint}
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
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🖨 Print / Download PDF
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
        <div
          style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}
          dangerouslySetInnerHTML={{ __html: `<style>${WORKBOOK_STYLES}</style>${html}` }}
        />
      </div>
    </div>
  );
}
