import { useState } from "react";
import Card from "./Card";

const BOARD_IMAGE = "/ynu-route-board.jpg";

// Shows the Yunnan University campus bus route-board photo as a reference.
// The stops and travel times in this dashboard are based on this board.
export default function RouteBoardReference() {
  const [imageOk, setImageOk] = useState(true);

  return (
    <Card
      title="Campus Bus Route Board"
      subtitle="Yunnan University reference"
    >
      {imageOk ? (
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-ink-950">
          <img
            src={BOARD_IMAGE}
            alt="Yunnan University campus bus route board"
            className="mx-auto max-h-[420px] w-full object-contain"
            onError={() => setImageOk(false)}
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-slate-700/60 bg-gradient-to-br from-ink-800 to-ink-950 px-6 text-center">
          <p className="text-xs text-slate-400">
            Route-board image not found. Add{" "}
            <span className="text-brand-400">ynu-route-board.jpg</span> into{" "}
            <span className="text-brand-400">visual_app/public/</span>.
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Z52 and Z53 are the original route-board codes. In this dashboard they
        are shown with the custom names YNU Engineering Express (Z52) and YNU
        Campus Connector (Z53). Their stops and travel times are taken from this
        route-board reference.
      </p>
    </Card>
  );
}
