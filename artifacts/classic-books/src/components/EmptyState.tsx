interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: 300,
      color: "#A8967E",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📚</div>
      <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: "#78716C" }}>
        {message}
      </div>
    </div>
  );
}
