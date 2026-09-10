// Fleet logic: how full a bus is, what the fleet looks like as a whole, and
// one hook that gives every screen the same fleet data.
//
// The fleet used to be a hardcoded array, which meant an admin could not add
// or retire a bus without a code change. It now lives in the `buses` table in
// Supabase (public read, admin-only write) with the hardcoded list kept as the
// offline fallback - the same three-layer story as stops and routes: cloud ->
// last good data -> bundled seed.
import { useCallback, useEffect, useState } from "react";
import { buses as seedBuses, type Bus } from "../data/campusData";
import { cloudFetchBuses, isCloudConfigured } from "./cloud";

export type LoadLevel = "low" | "medium" | "high";

export interface Load {
  /** Percentage of seats taken, 0-100. */
  pct: number;
  level: LoadLevel;
}

/** Clamp to 0-100 so a bad row (more riders than seats) can't break a bar. */
function toPct(onboard: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((onboard / capacity) * 100)));
}

function levelFor(pct: number): LoadLevel {
  return pct >= 75 ? "high" : pct >= 45 ? "medium" : "low";
}

/** How full one bus is. */
export function busLoad(bus: Bus): Load {
  const pct = toPct(bus.onboardCount, bus.capacity);
  return { pct, level: levelFor(pct) };
}

/**
 * How full a whole line is, pooled across the buses running it. Only buses
 * that are actually in service count - a bus parked for maintenance has seats,
 * but a rider cannot sit in them.
 */
export function lineLoad(fleet: Bus[], line: string): Load {
  const running = fleet.filter((b) => b.line === line && b.active);
  const onboard = running.reduce((sum, b) => sum + b.onboardCount, 0);
  const capacity = running.reduce((sum, b) => sum + b.capacity, 0);
  const pct = toPct(onboard, capacity);
  return { pct, level: levelFor(pct) };
}

export interface FleetSummary {
  total: number;
  active: number;
  offRoad: number;
  seats: number;
  riders: number;
  load: Load;
}

/** Headline fleet numbers for the admin overview. */
export function fleetSummary(fleet: Bus[]): FleetSummary {
  const active = fleet.filter((b) => b.active);
  const seats = active.reduce((sum, b) => sum + b.capacity, 0);
  const riders = active.reduce((sum, b) => sum + b.onboardCount, 0);
  const pct = toPct(riders, seats);
  return {
    total: fleet.length,
    active: active.length,
    offRoad: fleet.length - active.length,
    seats,
    riders,
    load: { pct, level: levelFor(pct) },
  };
}

/** The next free id, so a new bus never collides with an existing one. */
export function nextBusId(fleet: Bus[]): number {
  return fleet.reduce((max, b) => Math.max(max, b.id), 0) + 1;
}

/**
 * The fleet, from the cloud when it is reachable and from the bundled seed
 * when it is not. Every screen reads it through this hook so the admin panel
 * and the rider's capacity chip can never show different numbers.
 */
export function useFleet() {
  const [fleet, setFleet] = useState<Bus[]>(seedBuses);
  const [loading, setLoading] = useState(isCloudConfigured());

  const refresh = useCallback(async () => {
    if (!isCloudConfigured()) return;
    try {
      const rows = await cloudFetchBuses();
      // Never let an empty cloud result wipe a fleet we are already showing -
      // the same guard as safeApply, for the same reason (see CASE_STUDY.md).
      setFleet((current) => (rows.length > 0 || current.length === 0 ? rows : current));
    } catch {
      // Keep whatever is on screen; the seed is already there on first load.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { fleet, setFleet, loading, refresh };
}
