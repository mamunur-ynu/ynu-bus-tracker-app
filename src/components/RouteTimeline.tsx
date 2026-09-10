import { useState } from "react";
import Card from "./Card";
import { busLines, stopName, stopChinese, edgeTime, lineNameIn} from "../data/campusData";
import { useLang } from "../lib/i18n";

// A route timeline that lists the stops of a bus line in order.
// It shows the English name, the Chinese name, and the cumulative time.
export default function RouteTimeline() {
  const { t, lang } = useLang();
  const [lineCode, setLineCode] = useState("Z52");
  const line = busLines.find((l) => l.code === lineCode) ?? busLines[0];

  let cumulative = 0;
  const rows = line.stopIds.map((id, index) => {
    if (index > 0) {
      cumulative += edgeTime(line.stopIds[index - 1], id);
    }
    return { id, order: index + 1, cumulative };
  });

  return (
    <Card title={t("timeline.title")} subtitle={line.label}>
      <div className="mb-2">
        <p className="text-base font-semibold text-slate-100">
          {lineNameIn(line.code, lang)}
        </p>
        <p className="text-xs text-slate-400">Official route code: {line.code}</p>
      </div>
      <div className="mb-4 flex gap-2">
        {busLines.map((l) => (
          <button
            key={l.code}
            onClick={() => setLineCode(l.code)}
            className={`rounded-lg px-3 py-1.5 text-left transition-colors ${
              lineCode === l.code
                ? "border border-brand-500/50 bg-brand-500/15 text-brand-400"
                : "border border-slate-700 bg-ink-900 text-slate-300"
            }`}
          >
            <span className="block text-sm font-medium">{lineNameIn(l.code, lang)}</span>
            <span className="block text-[11px] opacity-70">{l.code}</span>
          </button>
        ))}
      </div>

      <ol className="relative border-l border-slate-700/70 pl-5">
        {rows.map((row, index) => (
          <li key={row.id} className="mb-4 last:mb-0">
            <span
              className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2"
              style={{ borderColor: line.color, background: "#0b1120" }}
            />
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {row.order}. {stopName(row.id)}
                </p>
                <p className="text-xs text-slate-400">{stopChinese(row.id)}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-brand-400">
                {index === 0 ? "start" : `${row.cumulative} min`}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
