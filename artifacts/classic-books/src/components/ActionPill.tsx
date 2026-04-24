interface ActionPillProps {
  label: string;
  icon?: string;
  secondary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionPill({ label, icon, secondary, onClick, disabled = false }: ActionPillProps) {
  return (
    <button
      className="action-pill"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        background: secondary ? "transparent" : "#92400E",
        border: secondary ? "1px solid #D4C9B8" : "none",
        color: secondary ? "#78716C" : "white",
        fontFamily: "'Source Sans 3', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: 5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      {label}
    </button>
  );
}
