interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "28px 32px",
          width: 400,
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 600,
          color: "#1C1917",
          marginBottom: 10,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: 14,
          color: "#78716C",
          lineHeight: 1.5,
          marginBottom: 24,
        }}>
          {message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "8px 18px",
              background: "#F0EBE1",
              border: "none",
              borderRadius: 6,
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "#1C1917",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "8px 18px",
              background: loading ? "#B91C1C88" : "#B91C1C",
              border: "none",
              borderRadius: 6,
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
