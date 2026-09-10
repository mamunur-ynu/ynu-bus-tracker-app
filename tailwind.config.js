/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1120",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
        // Royal Blue: the YNU Smart Mobility brand color (was a lighter sky
        // blue). Every `brand-400/500/600` utility across the app picks this
        // up automatically -- no per-component edits needed.
        brand: {
          400: "#60a5fa",
          500: "#2563eb",
          600: "#1d4ed8",
        },
        // Electric Green: the secondary accent, used alongside brand blue
        // for the two-tone premium identity (gradients, the Z53 route, the
        // "connected/active" state).
        accent: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Poppins", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(37,99,235,0.25)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "none" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease both",
        toastIn: "toastIn 0.25s ease both",
      },
    },
  },
  plugins: [],
};
