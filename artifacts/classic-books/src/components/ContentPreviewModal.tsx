const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Source+Sans+3:wght@400;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Source Sans 3', Georgia, serif;
    font-size: 13.5px;
    line-height: 1.65;
    color: #1C1917;
    background: #fff;
  }

  .workbook, .teacher-guide {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 48px;
  }

  /* ── Header ── */
  .wb-header {
    text-align: center;
    padding-bottom: 28px;
    margin-bottom: 32px;
    border-bottom: 2px solid #92400E;
  }
  .wb-title {
    font-size: 28px;
    font-weight: 700;
    color: #1C1917;
    letter-spacing: 0.5px;
    font-family: Georgia, serif;
    margin-bottom: 6px;
  }
  .wb-meta {
    font-size: 14px;
    color: #78716C;
    font-style: italic;
  }

  /* ── Sections ── */
  .wb-section, .tg-section {
    margin-bottom: 40px;
    page-break-inside: avoid;
  }
  .wb-section h2, .tg-section h2 {
    font-size: 18px;
    font-weight: 700;
    color: #92400E;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1.5px solid #E8E0D4;
    font-family: Georgia, serif;
  }
  .wb-instructions, .tg-instructions {
    color: #57534E;
    font-size: 13px;
    margin-bottom: 14px;
    font-style: italic;
  }

  /* ── Focus Question ── */
  .focus-question {
    background: #FEF7ED;
    border-left: 4px solid #92400E;
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin-top: 8px;
  }
  .focus-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #92400E;
    margin-bottom: 6px;
  }
  .focus-question p {
    font-size: 14px;
    line-height: 1.7;
    color: #1C1917;
  }

  /* ── Vocabulary Cards ── */
  .vocab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 8px;
  }
  .vocab-item {
    background: #F8F6F1;
    border: 1px solid #E8E0D4;
    border-radius: 8px;
    padding: 14px 16px;
  }
  .vocab-word {
    font-size: 16px;
    font-weight: 700;
    color: #92400E;
    margin-bottom: 5px;
    font-family: Georgia, serif;
  }
  .vocab-quote {
    font-size: 12px;
    color: #78716C;
    margin-bottom: 8px;
    line-height: 1.5;
    font-style: italic;
    border-left: 3px solid #D4C9B8;
    padding-left: 8px;
  }
  .vocab-def {
    font-size: 13px;
    margin-bottom: 5px;
    color: #1C1917;
    font-weight: 500;
  }
  .vocab-example {
    font-size: 12.5px;
    color: #57534E;
  }

  /* ── Question Lists ── */
  .question-list {
    padding-left: 20px;
    margin-top: 4px;
  }
  .question-item {
    margin-bottom: 22px;
    page-break-inside: avoid;
  }
  .question {
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .answer-space {
    border-bottom: 1px solid #C4B5A0;
    height: 28px;
    margin-bottom: 4px;
  }

  /* ── Multiple Choice ── */
  .mc-item {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .mc-options {
    list-style: none;
    padding-left: 12px;
    margin-top: 6px;
  }
  .mc-options li {
    margin-bottom: 5px;
    font-size: 13.5px;
    padding: 2px 0;
  }

  /* ── Creative / Writing ── */
  .hints {
    list-style: disc;
    padding-left: 22px;
    color: #57534E;
    font-size: 13px;
    margin: 10px 0 14px;
    line-height: 1.7;
  }
  .writing-space {
    border: 1.5px dashed #C4B5A0;
    min-height: 160px;
    border-radius: 6px;
    margin-top: 10px;
  }

  /* ── Timeline ── */
  .timeline-list {
    padding-left: 20px;
    margin-top: 6px;
  }
  .timeline-list li {
    margin-bottom: 10px;
    font-size: 13.5px;
    line-height: 1.5;
  }

  /* ── Tables (rubric, character chart, vocab teacher) ── */
  .rubric-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-top: 8px;
  }
  .rubric-table th {
    background: #F5F0E8;
    font-weight: 700;
    padding: 9px 12px;
    text-align: left;
    border: 1px solid #D4C9B8;
    color: #44403C;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .rubric-table td {
    border: 1px solid #E8E0D4;
    padding: 9px 12px;
    vertical-align: top;
    line-height: 1.5;
  }
  .rubric-table tr:nth-child(even) td { background: #FAFAF8; }

  /* ── Teacher Guide specific ── */
  .answer-item {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .answer {
    color: #065F46;
    font-size: 13px;
    margin-top: 4px;
    line-height: 1.6;
    padding-left: 10px;
    border-left: 3px solid #6EE7B7;
  }
  .discussion-note {
    background: #FFFBEB;
    border-left: 3px solid #F59E0B;
    padding: 8px 12px;
    font-size: 12.5px;
    color: #92400E;
    margin-top: 6px;
    border-radius: 0 4px 4px 0;
  }
  .diff-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
    margin-top: 8px;
  }
  .diff-card {
    background: #F8F6F1;
    border: 1px solid #E8E0D4;
    border-radius: 8px;
    padding: 14px;
  }
  .diff-card h3 {
    font-size: 12px;
    font-weight: 700;
    color: #92400E;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .tg-emphasis-heading {
    color: DarkGreen;
    font-size: calc(1em + 2pt);
  }
  .tg-no-italic {
    font-style: normal;
  }

  /* ── Print ── */
  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wb-section, .tg-section { page-break-inside: avoid; }
    .vocab-grid { page-break-inside: avoid; }
    .question-item { page-break-inside: avoid; }
  }
`;

const PREVIEW_STYLES = `
  * { box-sizing: border-box; }
  .workbook, .teacher-guide { font-family: 'Source Sans 3', Georgia, sans-serif; font-size: 13.5px; line-height: 1.65; color: #1C1917; }
  .wb-header { text-align: center; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 2px solid #92400E; }
  .wb-title { font-size: 24px; font-weight: 700; color: #1C1917; font-family: 'Playfair Display', Georgia, serif; margin-bottom: 4px; }
  .wb-meta { font-size: 13px; color: #78716C; font-style: italic; }
  .wb-section, .tg-section { margin-bottom: 32px; }
  .wb-section h2, .tg-section h2 { font-size: 17px; font-weight: 700; color: #92400E; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1.5px solid #E8E0D4; }
  .wb-instructions, .tg-instructions { color: #57534E; font-size: 13px; margin-bottom: 12px; font-style: italic; }
  .focus-question { background: #FEF7ED; border-left: 4px solid #92400E; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-top: 6px; }
  .focus-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #92400E; margin-bottom: 5px; }
  .focus-question p { font-size: 14px; line-height: 1.7; }
  .vocab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px; }
  .vocab-item { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 13px 15px; }
  .vocab-word { font-size: 15px; font-weight: 700; color: #92400E; margin-bottom: 4px; }
  .vocab-quote { font-size: 12px; color: #78716C; margin-bottom: 6px; line-height: 1.5; font-style: italic; border-left: 3px solid #D4C9B8; padding-left: 8px; }
  .vocab-def { font-size: 13px; margin-bottom: 4px; font-weight: 500; }
  .vocab-example { font-size: 12.5px; color: #57534E; }
  .question-list { padding-left: 18px; margin-top: 4px; }
  .question-item { margin-bottom: 18px; }
  .question { font-weight: 600; margin-bottom: 6px; font-size: 13.5px; }
  .answer-space { border-bottom: 1px solid #C4B5A0; height: 26px; margin-bottom: 3px; }
  .mc-item { margin-bottom: 16px; }
  .mc-options { list-style: none; padding-left: 10px; margin-top: 5px; }
  .mc-options li { margin-bottom: 4px; font-size: 13.5px; }
  .hints { list-style: disc; padding-left: 20px; color: #57534E; font-size: 13px; margin: 8px 0 12px; line-height: 1.7; }
  .writing-space { border: 1.5px dashed #C4B5A0; min-height: 120px; border-radius: 6px; margin-top: 8px; background: #FAFAF8; }
  .timeline-list { padding-left: 18px; margin-top: 6px; }
  .timeline-list li { margin-bottom: 8px; font-size: 13.5px; }
  .rubric-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
  .rubric-table th { background: #F5F0E8; font-weight: 700; padding: 8px 11px; text-align: left; border: 1px solid #D4C9B8; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #44403C; }
  .rubric-table td { border: 1px solid #E8E0D4; padding: 8px 11px; vertical-align: top; }
  .rubric-table tr:nth-child(even) td { background: #FAFAF8; }
  .answer-item { margin-bottom: 18px; }
  .answer { color: #065F46; font-size: 13px; margin-top: 4px; padding-left: 10px; border-left: 3px solid #6EE7B7; }
  .discussion-note { background: #FFFBEB; border-left: 3px solid #F59E0B; padding: 7px 11px; font-size: 12.5px; color: #92400E; margin-top: 6px; border-radius: 0 4px 4px 0; }
  .diff-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 8px; }
  .diff-card { background: #F8F6F1; border: 1px solid #E8E0D4; border-radius: 8px; padding: 12px; }
  .diff-card h3 { font-size: 11px; font-weight: 700; color: #92400E; margin-bottom: 7px; text-transform: uppercase; letter-spacing: 0.06em; }
  .tg-emphasis-heading { color: DarkGreen; font-size: calc(1em + 2pt); }
  .tg-no-italic { font-style: normal; }
`;

interface ContentPreviewModalProps {
  markdown: string;
  title: string;
  filename: string;
  onClose: () => void;
}

export function ContentPreviewModal({ markdown, title, filename, onClose }: ContentPreviewModalProps) {
  const handlePrintAsPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${PRINT_STYLES}</style>
</head>
<body>
${markdown}
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
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
          width: "min(900px, 96vw)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          border: "1px solid #E8E0D4",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
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
              onClick={handlePrintAsPdf}
              style={{
                padding: "8px 18px",
                background: "#92400E",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Download PDF
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
        <div style={{ overflowY: "auto", flex: 1, padding: "28px 36px" }}>
          <style>{PREVIEW_STYLES}</style>
          <div dangerouslySetInnerHTML={{ __html: markdown }} />
        </div>
      </div>
    </div>
  );
}
