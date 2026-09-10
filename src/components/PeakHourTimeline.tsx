import Card from "./Card";
import {
  schedules,
  isPeakHour,
  formatTime,
  lineNameIn,
  MORNING_PEAK_START_HOUR,
  MORNING_PEAK_END_HOUR,
  AFTERNOON_PEAK_START_HOUR,
  AFTERNOON_PEAK_END_HOUR,
} from "../data/campusData";
import { useLang } from "../lib/i18n";

const LEFT = 40;
const RIGHT = 780;
const SPAN = RIGHT - LEFT;

// Map an hour (0 to 24) to an x position on the timeline.
function hourToX(hour: number): number {
  return LEFT + (hour / 24) * SPAN;
}

// A 24 hour timeline that shades the two peak windows and marks the trips.
export default function PeakHourTimeline() {
  const { t, lang } = useLang();
  return (
    <Card title={t("peak.title")} subtitle={t("peak.subtitle")}>
      <svg viewBox="0 0 800 150" className="h-auto w-full" role="img" aria-label={t("peak.aria")}>
        {/* Peak windows */}
        <rect
          x={hourToX(MORNING_PEAK_START_HOUR)}
          y={40}
          width={hourToX(MORNING_PEAK_END_HOUR) - hourToX(MORNING_PEAK_START_HOUR)}
          height={40}
          fill="#f59e0b"
          opacity={0.18}
        />
        <rect
          x={hourToX(AFTERNOON_PEAK_START_HOUR)}
          y={40}
          width={hourToX(AFTERNOON_PEAK_END_HOUR) - hourToX(AFTERNOON_PEAK_START_HOUR)}
          height={40}
          fill="#f59e0b"
          opacity={0.18}
        />

        {/* Base line */}
        <line x1={LEFT} y1={60} x2={RIGHT} y2={60} stroke="#475569" strokeWidth={2} />

        {/* Hour ticks every 3 hours */}
        {Array.from({ length: 9 }, (_, i) => i * 3).map((hour) => (
          <g key={hour}>
            <line
              x1={hourToX(hour)}
              y1={56}
              x2={hourToX(hour)}
              y2={64}
              stroke="#64748b"
              strokeWidth={1}
            />
            <text x={hourToX(hour)} y={80} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {hour}:00
            </text>
          </g>
        ))}

        {/* Schedule markers */}
        {schedules.map((s) => {
          const x = hourToX(s.departure.hour + s.departure.minute / 60);
          const peak = isPeakHour(s.departure);
          return (
            <g key={s.id}>
              <circle cx={x} cy={60} r={7} fill={peak ? "#f59e0b" : "#60a5fa"} />
              <text x={x} y={34} textAnchor="middle" fontSize="11" fill="#e2e8f0">
                {formatTime(s.departure)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 space-y-2">
        {schedules.map((s) => {
          const peak = isPeakHour(s.departure);
          return (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-ink-950/30 px-3 py-2 text-sm"
            >
              <span className="text-slate-300">
                {formatTime(s.departure)} - {formatTime(s.arrival)} -{" "}
                {lineNameIn(s.line, lang)} ({s.line})
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs ${
                  peak
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-700/50 text-slate-400"
                }`}
              >
                {peak ? "Peak" : "Off-peak"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Trips are shown by their departure time on lines Z52 and Z53.
      </p>
    </Card>
  );
}
