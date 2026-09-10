import Card from "./Card";
import { stops, stopQueues } from "../data/campusData";

/**
 * Waiting passengers per stop.
 *
 * This used to print a full card for all thirteen stops, in id order, and on
 * a normal day ten of those cards said "No passengers waiting." - so the one
 * fact the panel exists to convey, where the queues actually are, was buried
 * among nine identical empty boxes and the panel ran to nearly twice the
 * height of everything beside it.
 *
 * Now the stops with people waiting come first, busiest at the top, and the
 * quiet ones are summarised as a single row of names underneath. Nothing is
 * hidden - every stop is still listed - but the length of the panel is now
 * proportional to how much is actually happening.
 */
export default function PassengerQueuePanel() {
  const withQueue = stops
    .map((stop) => ({ stop, queue: stopQueues[stop.id] ?? [] }))
    .filter((row) => row.queue.length > 0)
    .sort((a, b) => b.queue.length - a.queue.length);

  const quiet = stops.filter((stop) => (stopQueues[stop.id] ?? []).length === 0);

  return (
    <Card title="Passenger Queues" subtitle="Waiting passengers per stop">
      {withQueue.length === 0 ? (
        <p className="text-sm text-slate-400">
          No passengers waiting anywhere on campus right now.
        </p>
      ) : (
        <div className="space-y-3">
          {withQueue.map(({ stop, queue }) => (
            <div
              key={stop.id}
              className="rounded-lg border border-slate-700/50 bg-ink-950/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-200">
                  {stop.englishName}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {stop.chineseName}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-400">
                  {queue.length} waiting
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {queue.map((name, index) => (
                  <span
                    key={index}
                    className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-xs text-brand-400"
                  >
                    {index + 1}. {name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {quiet.length > 0 && (
        <div className="mt-4 border-t border-slate-800/70 pt-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            No one waiting ({quiet.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {quiet.map((stop) => (
              <span key={stop.id} className="text-xs text-slate-500">
                {stop.englishName}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
