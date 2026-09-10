// Loading the Amap (高德地图) JavaScript API.
//
// Amap is used rather than a generic tile map because this campus is in
// China: Google Maps is not reachable there, and OpenStreetMap's coverage of
// the inside of a Chinese university - buildings, footpaths, the names of
// canteens and dormitories - is thin. Amap has that data, in Chinese, and
// gives us POI search and walking directions over it.
//
// Two things about the key. It is a build-time variable, so it ends up in the
// bundle where anyone can read it; that is how Amap's browser API works, and
// the protection is the domain whitelist you set in their console, not
// secrecy. And when no key is configured this module simply reports that -
// the app then keeps its existing Leaflet map instead of showing a broken one.

const KEY = import.meta.env.VITE_AMAP_KEY ?? "";
const SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE ?? "";

/** Plugins the campus map needs. Loading them up front avoids a second wait. */
const PLUGINS = [
  "AMap.AutoComplete",
  "AMap.PlaceSearch",
  "AMap.Walking",
  "AMap.Geolocation",
  "AMap.Scale",
].join(",");

export function isAmapConfigured(): boolean {
  return KEY.trim().length > 0;
}

/** Minimal shape of the bits of the Amap SDK this project touches. */
export interface AMapSdk {
  Map: new (container: HTMLElement | string, opts: Record<string, unknown>) => AMapMap;
  Marker: new (opts: Record<string, unknown>) => AMapOverlay;
  Polyline: new (opts: Record<string, unknown>) => AMapOverlay;
  CircleMarker: new (opts: Record<string, unknown>) => AMapOverlay;
  InfoWindow: new (opts: Record<string, unknown>) => {
    open: (map: AMapMap, position: [number, number]) => void;
    close: () => void;
  };
  Bounds: new (sw: [number, number], ne: [number, number]) => unknown;
  Scale: new (opts?: Record<string, unknown>) => unknown;
  AutoComplete: new (opts: Record<string, unknown>) => {
    search: (keyword: string, cb: (status: string, result: AutoCompleteResult) => void) => void;
  };
  PlaceSearch: new (opts: Record<string, unknown>) => {
    search: (keyword: string, cb: (status: string, result: PlaceSearchResult) => void) => void;
  };
  Walking: new (opts: Record<string, unknown>) => {
    search: (
      from: [number, number],
      to: [number, number],
      cb: (status: string, result: WalkingResult) => void
    ) => void;
    clear: () => void;
  };
}

export interface AMapMap {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void;
  remove: (overlay: AMapOverlay | AMapOverlay[]) => void;
  addControl: (control: unknown) => void;
  setFitView: (overlays?: AMapOverlay[] | null, immediately?: boolean, avoid?: number[]) => void;
  setCenter: (position: [number, number]) => void;
  setZoom: (zoom: number) => void;
  destroy: () => void;
  on: (event: string, handler: (e: unknown) => void) => void;
}

export interface AMapOverlay {
  setPosition?: (position: [number, number]) => void;
  setAngle?: (angle: number) => void;
  setMap?: (map: AMapMap | null) => void;
  getPosition?: () => { lng: number; lat: number };
  on?: (event: string, handler: (e: unknown) => void) => void;
}

export interface AmapPoi {
  id: string;
  name: string;
  address?: string;
  district?: string;
  /** Amap returns GCJ-02 here, not GPS. */
  location?: { lng: number; lat: number };
}

interface AutoCompleteResult {
  tips?: Array<{ name: string; district?: string; adcode?: string; location?: { lng: number; lat: number } }>;
}
interface PlaceSearchResult {
  poiList?: { pois?: AmapPoi[] };
}
export interface WalkingStep {
  instruction: string;
  distance: number;
  time: number;
}
interface WalkingResult {
  routes?: Array<{ distance: number; time: number; steps?: WalkingStep[] }>;
}
export type { AutoCompleteResult, PlaceSearchResult, WalkingResult };

declare global {
  interface Window {
    AMap?: AMapSdk;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

let pending: Promise<AMapSdk> | null = null;

/**
 * Load the SDK once and hand back the same promise afterwards.
 *
 * Injecting the script twice would re-register the plugins and is a common
 * cause of "AMap is not defined" in React, where an effect can run twice in
 * development. The security config has to be set on `window` *before* the
 * script tag is added - Amap reads it as it initialises, so setting it after
 * has no effect and every request comes back INVALID_USER_SCODE.
 */
export function loadAmap(): Promise<AMapSdk> {
  if (!isAmapConfigured()) {
    return Promise.reject(new Error("No Amap key configured"));
  }
  if (window.AMap) return Promise.resolve(window.AMap);
  if (pending) return pending;

  pending = new Promise<AMapSdk>((resolve, reject) => {
    if (SECURITY_CODE) {
      window._AMapSecurityConfig = { securityJsCode: SECURITY_CODE };
    }
    const script = document.createElement("script");
    script.async = true;
    script.src =
      `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(KEY)}` +
      `&plugin=${encodeURIComponent(PLUGINS)}`;
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      // A key that is rejected still loads the script but leaves no global,
      // so this is the path a wrong key or an unlisted domain takes.
      else reject(new Error("Amap script loaded but AMap was not defined"));
    };
    script.onerror = () => {
      pending = null; // let a later attempt retry rather than fail forever
      reject(new Error("Could not reach webapi.amap.com"));
    };
    document.head.appendChild(script);
  });
  return pending;
}
