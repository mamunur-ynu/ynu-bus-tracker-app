import { describe, it, expect, beforeEach, vi } from "vitest";

// A minimal localStorage stand-in so the module can run under Node.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const { toggleFavorite, isFavorite } = await import("./favorites");

describe("favorites", () => {
  beforeEach(() => {
    // reset to a known state
    for (const id of [1, 2, 3]) if (isFavorite(id)) toggleFavorite(id);
  });

  it("starts empty", () => {
    expect(isFavorite(1)).toBe(false);
  });

  it("adds and removes a stop", () => {
    toggleFavorite(1);
    expect(isFavorite(1)).toBe(true);
    toggleFavorite(1);
    expect(isFavorite(1)).toBe(false);
  });

  it("keeps several favourites independently", () => {
    toggleFavorite(1);
    toggleFavorite(2);
    expect(isFavorite(1)).toBe(true);
    expect(isFavorite(2)).toBe(true);
    expect(isFavorite(3)).toBe(false);
  });

  it("persists to storage", () => {
    toggleFavorite(2);
    expect(JSON.parse(store.get("favoriteStops") as string)).toContain(2);
  });
});
