// Real-world geography: distances, bearings, and how much to trust a GPS fix.
//
// Everything here works in real latitude/longitude degrees, not the map-image
// percentages the rest of the app uses for the illustrated campus map. That
// distinction matters: the x/y on a Stop are positions on a picture, while
// these are positions on Earth, and quietly mixing the two would produce
// confident nonsense.

const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  latitude: number;
  longitude: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Great-circle distance in metres (haversine).
 *
 * Straight-line, not driving distance - the bus follows roads, so this is a
 * lower bound. Anything that shows it to a rider should say "away", not
 * "to drive".
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from a to b, in degrees clockwise from north (0-360). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Position a fraction of the way from a to b, for sliding a marker between
 * two GPS fixes instead of letting it teleport. Linear in degrees, which over
 * the few hundred metres a bus moves between updates is far below the width
 * of the marker itself.
 */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.max(0, Math.min(1, t));
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * k,
    longitude: a.longitude + (b.longitude - a.longitude) * k,
  };
}

/**
 * Shortest way to turn from one heading to another, in degrees (-180..180).
 * Without this a bus turning from 350° to 10° spins 340° the wrong way round.
 */
export function headingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export type Freshness = "live" | "stale" | "lost";

/**
 * How much to trust a position, given how long ago it arrived.
 *
 * A tracking map that shows a confident bus icon over a five-minute-old fix is
 * worse than one that admits it does not know: the rider waits at a stop for a
 * bus that already left. So anything past a few seconds is marked stale, and
 * past a minute it is treated as lost rather than displayed as current.
 */
export function freshness(ageSeconds: number): Freshness {
  if (ageSeconds <= 10) return "live";
  if (ageSeconds <= 60) return "stale";
  return "lost";
}

export function ageSeconds(updatedAt: string | number | Date, now = Date.now()): number {
  const t = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - t) / 1000);
}

export type Accuracy = "high" | "medium" | "low" | "unknown";

/** Phone GPS accuracy, as reported by the device, bucketed for display. */
export function accuracyLevel(metres: number | null | undefined): Accuracy {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) {
    return "unknown";
  }
  if (metres <= 20) return "high";
  if (metres <= 50) return "medium";
  return "low";
}

/** "850 m" / "1.2 km" - the way a rider reads a distance. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "—";
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// A bus that is stopped at a light shouldn't produce an ETA of infinity, and a
// bad GPS spike shouldn't produce 300 km/h. Clamp to something a campus
// shuttle can actually do.
const MIN_SPEED_KMH = 8;
const MAX_SPEED_KMH = 80;

/**
 * Minutes until the bus covers `metres`, from its current speed.
 *
 * Only ever as good as its inputs, so it is deliberately simple and honest:
 * straight-line distance over current speed, with the speed clamped to a
 * believable range. It does NOT claim to model traffic or historical
 * behaviour - there is no traffic feed and no ride history in this system, and
 * a number dressed up as "AI-predicted" from data that does not exist would
 * just be a guess with a confident label on it.
 */
export function etaMinutes(metres: number, speedKmh: number | null | undefined): number {
  if (!Number.isFinite(metres) || metres < 0) return Number.POSITIVE_INFINITY;
  const raw = Number.isFinite(speedKmh as number) ? (speedKmh as number) : 0;
  const speed = Math.min(MAX_SPEED_KMH, Math.max(MIN_SPEED_KMH, raw));
  const hours = metres / 1000 / speed;
  return Math.max(0, hours * 60);
}

/** m/s from the Geolocation API to km/h, tolerating null. */
export function msToKmh(metresPerSecond: number | null | undefined): number | null {
  if (metresPerSecond === null || metresPerSecond === undefined) return null;
  if (!Number.isFinite(metresPerSecond) || metresPerSecond < 0) return null;
  return metresPerSecond * 3.6;
}

/** The nearest stop that has had its real coordinates captured. */
export function nearestStop<T extends { latitude?: number | null; longitude?: number | null }>(
  from: LatLng,
  stops: T[]
): { stop: T; metres: number } | null {
  let best: { stop: T; metres: number } | null = null;
  for (const s of stops) {
    if (
      s.latitude === null ||
      s.latitude === undefined ||
      s.longitude === null ||
      s.longitude === undefined
    ) {
      continue; // not calibrated yet - skip rather than guess where it is
    }
    const metres = distanceMeters(from, {
      latitude: s.latitude,
      longitude: s.longitude,
    });
    if (!best || metres < best.metres) best = { stop: s, metres };
  }
  return best;
}
