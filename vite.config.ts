import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Vite configuration for the visual companion dashboard (v2).
// VitePWA makes the app installable on a phone home screen.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing third-party libraries into their own
        // chunks. three.js (used only by the lazy-loaded 3D city view) and
        // @supabase/supabase-js otherwise get bundled together with the rest
        // of the app code, so every small app change forces visitors to
        // re-download the whole heavy vendor code too. Splitting them means
        // the browser can cache "three.js hasn't changed" separately from
        // "the app code changed" — faster repeat visits on campus wifi.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("three")) return "vendor-three";
          if (id.includes("@supabase")) return "vendor-supabase";
          return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["ynu-campus-map.jpg", "ynu-route-board.jpg"],
      workbox: {
        // Precache the shell, code chunks and campus imagery so the map and
        // route search keep working with no network.
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: "YNU Smart Campus Bus Tracker",
        short_name: "YNU Bus",
        description:
          "Yunnan University Smart Campus Bus Tracker and Route Optimizer",
        theme_color: "#0ea5e9",
        background_color: "#0b1120",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
