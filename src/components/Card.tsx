import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

// A simple reusable panel used across the dashboard.
export default function Card({ title, subtitle, children, className }: CardProps) {
  return (
    <section className={`card p-5 ${className ?? ""}`}>
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="card-title">{title}</h2>
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
