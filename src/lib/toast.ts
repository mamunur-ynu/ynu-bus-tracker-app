// Tiny global toast system. Call toast.success("...") from anywhere; the
// <Toaster /> component subscribes and renders the messages. No context
// plumbing needed, so it works even inside large existing components.

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(items);
}

function push(kind: ToastKind, message: string, ms = 3000) {
  const id = nextId++;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ms);
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m, 4000),
  info: (m: string) => push("info", m),
};

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  fn(items);
  return () => {
    listeners.delete(fn);
  };
}
