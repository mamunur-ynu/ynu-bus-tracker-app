// Dijkstra shortest route search in TypeScript.
// This mirrors the C++ CampusTransportSystem::findShortestRoute function.
// The stops are graph nodes and the routes are directed graph edges.
// The edge weight is travelTimeMinutes + delayMinutes, so a delay on a
// route changes the shortest path in the same way as the C++ program.

import type { Route, Stop } from "../data/campusData";

export interface ShortestRouteResult {
  found: boolean;
  path: number[]; // stop ids in order from source to destination
  routeIds: number[]; // route ids used along the path
  totalMinutes: number;
}

const INF = Number.POSITIVE_INFINITY;

export function edgeWeight(route: Route): number {
  return route.travelTimeMinutes + route.delayMinutes;
}

export function findShortestRoute(
  stops: Stop[],
  routes: Route[],
  sourceStopId: number,
  destinationStopId: number
): ShortestRouteResult {
  const empty: ShortestRouteResult = {
    found: false,
    path: [],
    routeIds: [],
    totalMinutes: 0,
  };

  const sourceExists = stops.some((s) => s.id === sourceStopId);
  const destExists = stops.some((s) => s.id === destinationStopId);
  if (!sourceExists || !destExists) {
    return empty;
  }

  // Set up the working maps for every stop id.
  const distance = new Map<number, number>();
  const visited = new Map<number, boolean>();
  const previousStop = new Map<number, number>();
  const previousRoute = new Map<number, number>();

  for (const stop of stops) {
    distance.set(stop.id, INF);
    visited.set(stop.id, false);
  }
  distance.set(sourceStopId, 0);

  // Main loop. Each round picks the nearest unvisited stop.
  for (let step = 0; step < stops.length; step++) {
    let current = -1;
    let best = INF;
    for (const stop of stops) {
      const d = distance.get(stop.id) ?? INF;
      if (!visited.get(stop.id) && d < best) {
        best = d;
        current = stop.id;
      }
    }

    if (current === -1) {
      break; // no reachable stop is left
    }
    visited.set(current, true);

    // Relax every route that starts at the current stop.
    for (const route of routes) {
      if (route.sourceStopId !== current) {
        continue;
      }
      const to = route.destinationStopId;
      const newDistance = (distance.get(current) ?? INF) + edgeWeight(route);
      if (newDistance < (distance.get(to) ?? INF)) {
        distance.set(to, newDistance);
        previousStop.set(to, current);
        previousRoute.set(to, route.id);
      }
    }
  }

  const finalDistance = distance.get(destinationStopId) ?? INF;
  if (finalDistance === INF) {
    return empty; // no path found
  }

  // Rebuild the path by walking backward through the previous maps.
  const path: number[] = [];
  const routeIds: number[] = [];
  let walk = destinationStopId;
  while (walk !== sourceStopId) {
    path.push(walk);
    const usedRoute = previousRoute.get(walk);
    if (usedRoute !== undefined) {
      routeIds.push(usedRoute);
    }
    const prev = previousStop.get(walk);
    if (prev === undefined) {
      break;
    }
    walk = prev;
  }
  path.push(sourceStopId);
  path.reverse();
  routeIds.reverse();

  return {
    found: true,
    path,
    routeIds,
    totalMinutes: finalDistance,
  };
}
