// The driver end of the tracking pipeline: read this phone's real GPS and
// publish it as the bus's position.
//
// This uses navigator.geolocation, so the coordinates are genuinely from the
// device's satellite/network fix - there is no simulated movement here. What
// it cannot do is invent a position when the driver refuses permission or the
// signal drops, and it does not pretend to: every failure becomes a state the
// UI can show, rather than a gap where the last known position quietly ages.
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudPublishLocation, isCloudConfigured } from "./cloud";
import { msToKmh } from "./geo";

export type BroadcastState =
  | "idle"
  | "requesting"
  | "broadcasting"
  | "denied"
  | "unavailable"
  | "error";

export interface BroadcastStatus {
  state: BroadcastState;
  /** Last fix taken from the device. */
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  heading: number | null;
  accuracyM: number | null;
  /** When the last fix was published successfully. */
  lastSentAt: number | null;
  /** Why the last publish failed, if it did. */
  sendError: string | null;
  fixCount: number;
}

const IDLE: BroadcastStatus = {
  state: "idle",
  latitude: null,
  longitude: null,
  speedKmh: null,
  heading: null,
  accuracyM: null,
  lastSentAt: null,
  sendError: null,
  fixCount: 0,
};

// How often to write to the database. The device reports far more often than
// this; publishing every fix would be a write per second per bus for no visual
// gain, since the map interpolates between points anyway.
const PUBLISH_EVERY_MS = 3000;

export function useGpsBroadcast(busId: number | null, enabled: boolean) {
  const [status, setStatus] = useState<BroadcastStatus>(IDLE);
  const watchRef = useRef<number | null>(null);
  const lastPublishRef = useRef(0);
  const busRef = useRef<number | null>(busId);
  busRef.current = busId;

  const stop = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setStatus((s) => ({ ...s, state: "idle" }));
  }, []);

  useEffect(() => {
    if (!enabled || busId === null) {
      if (watchRef.current !== null) {
        navigator.geolocation?.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      setStatus(IDLE);
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus({ ...IDLE, state: "unavailable" });
      return;
    }

    setStatus((s) => ({ ...s, state: "requesting" }));

    const onFix = async (pos: GeolocationPosition) => {
      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const speedKmh = msToKmh(speed);
      setStatus((s) => ({
        ...s,
        state: "broadcasting",
        latitude,
        longitude,
        speedKmh,
        // A stationary phone reports heading as null; keep the last known one
        // so the marker doesn't snap back to north every time it stops.
        heading: heading !== null && !Number.isNaN(heading) ? heading : s.heading,
        accuracyM: accuracy ?? null,
        fixCount: s.fixCount + 1,
      }));

      const now = Date.now();
      if (now - lastPublishRef.current < PUBLISH_EVERY_MS) return;
      lastPublishRef.current = now;

      const bus = busRef.current;
      if (bus === null || !isCloudConfigured()) return;
      const err = await cloudPublishLocation({
        busId: bus,
        latitude,
        longitude,
        speedKmh,
        heading: heading !== null && !Number.isNaN(heading) ? heading : null,
        accuracyM: accuracy ?? null,
      });
      setStatus((s) => ({
        ...s,
        sendError: err,
        lastSentAt: err ? s.lastSentAt : Date.now(),
      }));
    };

    const onError = (err: GeolocationPositionError) => {
      // PERMISSION_DENIED is the driver saying no, which is a different
      // problem from the phone being unable to get a fix - the UI needs to
      // tell them which one it is, not just "location error".
      setStatus((s) => ({
        ...s,
        state:
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.POSITION_UNAVAILABLE
              ? "unavailable"
              : "error",
      }));
    };

    watchRef.current = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    });

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [enabled, busId]);

  return { status, stop };
}
