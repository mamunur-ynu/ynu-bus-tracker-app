import Card from "./Card";

interface Scenario {
  bus: string;
  stop: string;
  waiting: number;
  capacity: number;
  onboard: number;
}

// The same capacity rule as the C++ showCapacityAlert function.
function capacityStatus(waiting: number, capacity: number, onboard: number) {
  const free = capacity - onboard;
  if (onboard >= capacity) {
    return { label: "Bus is full", tone: "red" as const, free };
  }
  if (waiting > free) {
    return {
      label: "Extra or larger bus recommended",
      tone: "amber" as const,
      free,
    };
  }
  return { label: "Capacity is enough", tone: "green" as const, free };
}

const toneClass: Record<string, string> = {
  green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  red: "border-red-400/30 bg-red-500/10 text-red-300",
};

const scenarios: Scenario[] = [
  { bus: "BUS-Z52B", stop: "School Hospital", waiting: 2, capacity: 45, onboard: 10 },
  { bus: "MINI-Z9", stop: "YNU Library", waiting: 6, capacity: 4, onboard: 0 },
  { bus: "BUS-Z53A", stop: "YNU Library", waiting: 6, capacity: 35, onboard: 35 },
];

// Shows three capacity examples: enough, not enough, and full.
export default function CapacityAlertPanel() {
  return (
    <Card title="Capacity Alerts" subtitle="Waiting passengers vs free seats">
      <div className="space-y-3">
        {scenarios.map((sc, index) => {
          const status = capacityStatus(sc.waiting, sc.capacity, sc.onboard);
          return (
            <div
              key={index}
              className="rounded-lg border border-slate-700/50 bg-ink-950/30 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">
                  {sc.bus} at {sc.stop}
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs ${toneClass[status.tone]}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Waiting {sc.waiting}, capacity {sc.capacity}, onboard{" "}
                {sc.onboard}, free seats {status.free}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
