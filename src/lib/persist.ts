// Simple browser persistence layer.
// Right now it saves to localStorage. Later this same file can be swapped to
// talk to a real database (Supabase or Firebase) without changing the UI.
import { stops as defaultStops, routes as defaultRoutes } from "../data/campusData";
import type { Stop, Route } from "../data/campusData";

const STOPS_KEY = "v2_stops";
const ROUTES_KEY = "v2_routes";

export function loadStops(): Stop[] {
  try {
    const saved = localStorage.getItem(STOPS_KEY);
    if (saved) return JSON.parse(saved) as Stop[];
  } catch {
    // ignore and fall back to defaults
  }
  return defaultStops.map((s) => ({ ...s }));
}

export function loadRoutes(): Route[] {
  try {
    const saved = localStorage.getItem(ROUTES_KEY);
    if (saved) return JSON.parse(saved) as Route[];
  } catch {
    // ignore and fall back to defaults
  }
  return defaultRoutes.map((r) => ({ ...r }));
}

export function saveStops(list: Stop[]): void {
  localStorage.setItem(STOPS_KEY, JSON.stringify(list));
}

export function saveRoutes(list: Route[]): void {
  localStorage.setItem(ROUTES_KEY, JSON.stringify(list));
}

export function resetAll(): void {
  localStorage.removeItem(STOPS_KEY);
  localStorage.removeItem(ROUTES_KEY);
}
