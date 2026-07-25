import { describe, it, expect } from "vitest";
import { findShortestRoute, edgeWeight } from "./dijkstra";
import type { Stop, Route } from "../data/campusData";

const stop = (id: number): Stop => ({
  id,
  englishName: `Stop ${id}`,
  chineseName: `站 ${id}`,
  x: 0,
  y: 0,
  passengerCount: 0,
});

const route = (
  id: number,
  from: number,
  to: number,
  minutes: number,
  delay = 0
): Route => ({
  id,
  name: `${from}->${to}`,
  sourceStopId: from,
  destinationStopId: to,
  travelTimeMinutes: minutes,
  delayMinutes: delay,
});

const stops = [stop(1), stop(2), stop(3)];

describe("edgeWeight", () => {
  it("adds travel time and delay", () => {
    expect(edgeWeight(route(1, 1, 2, 5, 3))).toBe(8);
  });
});

describe("findShortestRoute", () => {
  it("prefers the cheaper multi-hop path", () => {
    const routes = [route(1, 1, 2, 5), route(2, 2, 3, 5), route(3, 1, 3, 20)];
    const r = findShortestRoute(stops, routes, 1, 3);
    expect(r.found).toBe(true);
    expect(r.totalMinutes).toBe(10);
    expect(r.path).toEqual([1, 2, 3]);
    expect(r.routeIds).toEqual([1, 2]);
  });

  it("re-routes when a delay makes the multi-hop path slower", () => {
    const routes = [
      route(1, 1, 2, 5, 20), // delayed
      route(2, 2, 3, 5),
      route(3, 1, 3, 20),
    ];
    const r = findShortestRoute(stops, routes, 1, 3);
    expect(r.found).toBe(true);
    expect(r.totalMinutes).toBe(20);
    expect(r.path).toEqual([1, 3]);
  });

  it("returns not found for an unknown source", () => {
    const r = findShortestRoute(stops, [], 99, 3);
    expect(r.found).toBe(false);
    expect(r.path).toEqual([]);
  });

  it("returns not found when no path exists", () => {
    const r = findShortestRoute(stops, [route(1, 1, 2, 5)], 1, 3);
    expect(r.found).toBe(false);
  });

  it("handles source equal to destination", () => {
    const r = findShortestRoute(stops, [], 1, 1);
    expect(r.found).toBe(true);
    expect(r.totalMinutes).toBe(0);
    expect(r.path).toEqual([1]);
  });
});
