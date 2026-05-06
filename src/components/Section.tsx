import type { ReactNode } from "react";

interface Props {
  title: string;
  filled?: number;
  total?: number;
  children: ReactNode;
}

export function Section({ title, filled, total, children }: Props) {
  const showProgress = typeof filled === "number" && typeof total === "number" && total > 0;
  return (
    <section className="section">
      <h2>
        <span>{title}</span>
        {showProgress && (
          <span className="progress">
            {filled}/{total} fields
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
