import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf6", 100: "#d7f3e8", 200: "#b0e6d2", 300: "#7dd3b6", 400: "#47b996",
          500: "#259d7d", 600: "#187e65", 700: "#156553", 800: "#135143", 900: "#114238",
        },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
