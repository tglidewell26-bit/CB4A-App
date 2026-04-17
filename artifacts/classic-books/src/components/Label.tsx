import type { ReactNode } from "react";

interface LabelProps {
  children: ReactNode;
  mt?: number;
}

export function Label({ children, mt }: LabelProps) {
  return (
    <div style={{
      fontFamily: "'Source Sans 3', sans-serif",
      fontSize: 11,
      fontWeight: 600,
      color: "#78716C",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 5,
      marginTop: mt ?? 0,
    }}>
      {children}
    </div>
  );
}
