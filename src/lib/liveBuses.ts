// Live bus positions, as one hook every screen can share.
//
// Realtime first, polling as a fallback. That is not belt-and-braces for its
// own sake: a WebSocket to a service hosted abroad is the first thing an
// unreliable campus network drops, and a tracking map that silently freezes is
// worse than one that refreshes every few seconds and says so.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloudFetchBusLocations,
  isCloudConfigured,
  subscribeToBusLocations,
  type BusLocation,
  type RealtimeStatus,
} from "./cloud";

const POLL_MS = 5000;

export interface LiveBusesState {
  /** Latest known position per bus id. */
  locations: Map<number, BusLocation>;
  /** True while the realtime socket is connected. */
  realtime: boolean;
  /** Set if the very first load failed outright. */
  error: string | null;
}

export function useLiveBuses(): LiveBusesState & { refresh: () => Promise<void> } {
  const [locations, setLocations] = useState<Map<number, BusLocation>>(new Map());
  const [realtime, setRealtime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept in a ref as well so the poll can compare without re-subscribing.
  const realtimeRef = useRef(false);

  const apply = useCallback((rows: BusLocation[]) => {
    setLocations((prev) => {
      const next = new Map(prev);
      for (const r of rows) next.set(r.busId, r);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isCloudConfigured()) return;
    try {
      const rows = await cloudFetchBusLocations();
      // A bus that has stopped reporting should disappear from the map rather
      // than linger at its last position forever, so replace wholesale here
      // instead of merging - the server list is the truth.
      setLocations(new Map(rows.map((r) => [r.busId, r])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    void refresh();

    const unsub = subscribeToBusLocations(
      (loc) => apply([loc]),
      (status: RealtimeStatus) => {
        const up = status === "SUBSCRIBED";
        realtimeRef.current = up;
        setRealtime(up);
      }
    );

    // Poll regardless of socket state, but only do the work when the socket
    // is not carrying updates - this is the layer that keeps the map moving
    // when realtime cannot connect at all.
    const id = window.setInterval(() => {
      if (!realtimeRef.current) void refresh();
    }, POLL_MS);

    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [refresh, apply]);

  return { locations, realtime, error, refresh };
}
