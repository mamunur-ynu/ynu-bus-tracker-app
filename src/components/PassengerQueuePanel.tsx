import Card from "./Card";
import { stops, stopQueues } from "../data/campusData";

// Shows the waiting passengers at each stop as a simple queue view.
export default function PassengerQueuePanel() {
  return (
    <Card title="Passenger Queues" subtitle="Waiting passengers per stop">
      <div className="space-y-3">
        {stops.map((stop) => {
          const queue = stopQueues[stop.id] ?? [];
          return (
            <div
              key={stop.id}
              className="rounded-lg border border-slate-700/50 bg-ink-950/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">
                  {stop.englishName}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {stop.chineseName}
                  </span>
                </span>
                <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                  {queue.length} waiting
                </span>
              </div>
              {queue.length === 0 ? (
                <p className="text-xs text-slate-500">No passengers waiting.</p>
              ) : (
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
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
