/// <reference types="vite/client" />

// Build-time configuration. Both are optional: the map falls back to
// OpenStreetMap when they are not set.
interface ImportMetaEnv {
  /** Tile URL template, e.g. a provider that is reachable in mainland China. */
  readonly VITE_MAP_TILE_URL?: string;
  /** Attribution text required by whichever tile provider is used. */
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;

  /**
   * Amap (高德地图) JS API key, from lbs.amap.com. Leave unset and the app
   * keeps using the Leaflet/OpenStreetMap map - nothing breaks.
   */
  readonly VITE_AMAP_KEY?: string;
  /**
   * The matching security code (安全密钥) that Amap's JS API 2.0 requires
   * alongside the key. Amap's own documentation has you put this in the page,
   * so it is visible to anyone who looks - which is exactly why the key it
   * belongs to should be restricted to your own domain in the Amap console.
   */
  readonly VITE_AMAP_SECURITY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
