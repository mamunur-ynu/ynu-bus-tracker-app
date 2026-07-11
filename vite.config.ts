import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Vite configuration for the visual companion dashboard (v2).
// VitePWA makes the app installable on a phone home screen.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["ynu-campus-map.jpg", "ynu-route-board.jpg"],
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
