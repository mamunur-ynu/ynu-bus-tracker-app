/// <reference types="vite/client" />

// Build-time configuration. Both are optional: the map falls back to
// OpenStreetMap when they are not set.
interface ImportMetaEnv {
  /** Tile URL template, e.g. a provider that is reachable in mainland China. */
  readonly VITE_MAP_TILE_URL?: string;
  /** Attribution text required by whichever tile provider is used. */
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
