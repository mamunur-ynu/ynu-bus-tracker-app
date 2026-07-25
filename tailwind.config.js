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
        brand: {
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(56,189,248,0.25)",
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
