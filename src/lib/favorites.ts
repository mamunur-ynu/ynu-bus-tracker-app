// Favourite stops, remembered in the browser. Same tiny store pattern as
// toast/i18n so any component can read and update without prop drilling.
import { useEffect, useState } from "react";

const KEY = "favoriteStops";

function read(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

let favorites: number[] = typeof localStorage !== "undefined" ? read() : [];
const listeners = new Set<(ids: number[]) => void>();

function commit(next: number[]) {
  favorites = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable */
  }
  for (const fn of listeners) fn(next);
}

export function toggleFavorite(stopId: number) {
  commit(
    favorites.includes(stopId)
      ? favorites.filter((id) => id !== stopId)
      : [...favorites, stopId]
  );
}

export function isFavorite(stopId: number) {
  return favorites.includes(stopId);
}

// React hook: re-renders when the favourites change.
export function useFavorites() {
  const [ids, setIds] = useState<number[]>(favorites);
  useEffect(() => {
    const fn = (next: number[]) => setIds(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { favorites: ids, toggleFavorite, isFavorite: (id: number) => ids.includes(id) };
}
