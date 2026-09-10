import { useEffect, useState } from "react";
import { subscribeToasts, type ToastItem } from "../lib/toast";

const styles: Record<ToastItem["kind"], string> = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  error: "border-rose-500/40 bg-rose-500/15 text-rose-200",
  info: "border-brand-500/40 bg-brand-500/15 text-blue-200",
};

const icons: Record<ToastItem["kind"], string> = {
  success: "✓",
  error: "!",
  info: "i",
};

// Renders the global toast queue in the bottom-right corner.
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,340px)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-toastIn pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${styles[t.kind]}`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
            {icons[t.kind]}
          </span>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
