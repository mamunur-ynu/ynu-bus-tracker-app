import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { stops, routes } from "../data/campusData";
import { askAssistant } from "../lib/assistant";
import { useLang } from "../lib/i18n";

interface Msg {
  role: "user" | "assistant";
  text: string;
  source?: "ai" | "local";
}

// A chat assistant that answers campus travel questions in natural language.
// The model calls the app's own Dijkstra search as a tool, so every travel
// time it quotes is really computed, not guessed.
export default function AIAssistant() {
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const samples =
    lang === "zh"
      ? ["东门到图书馆要多久？", "哪个站等车的人最多？", "从校医院怎么去现代工学院？"]
      : [
          "How long from East Gate to the Library?",
          "Which stop is busiest?",
          "How do I get from School Hospital to Engineering College?",
        ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    const reply = await askAssistant(question, stops, routes, lang);
    setMsgs((m) => [...m, { role: "assistant", text: reply.text, source: reply.source }]);
    setBusy(false);
  }

  return (
    <Card title={t("ai.title")} subtitle={t("ai.subtitle")}>
      <div className="flex max-h-[420px] min-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
            <p className="text-sm text-slate-300">{t("ai.hello")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {samples.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-500/50 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand-500/20 text-blue-100"
                  : "border border-slate-700/50 bg-ink-950/50 text-slate-200"
              }`}
            >
              {m.text}
              {m.role === "assistant" && m.source === "local" && (
                <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-500">
                  {t("ai.offline")}
                </span>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-700/50 bg-ink-950/50 px-4 py-2.5 text-sm text-slate-400">
              {t("ai.thinking")}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("ai.placeholder")}
          aria-label={t("ai.placeholder")}
          className="flex-1 rounded-full border border-slate-700 bg-ink-950/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full border border-brand-500/50 bg-brand-500/15 px-5 py-2.5 text-sm font-semibold text-brand-400 disabled:opacity-40"
        >
          {t("ai.send")}
        </button>
      </form>
    </Card>
  );
}
