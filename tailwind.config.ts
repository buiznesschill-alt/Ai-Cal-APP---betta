import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fitcal: {
          mint: "#00C896",
          mintDark: "#00A87A",
          mintLight: "#E6F7F0",
          orange: "#FF8A3D",
          orangeLight: "#FFF0E6",
          dark: "#1A1C1E",
          gray: "#6B7280",
          bg: "#F8F9FA",
          card: "#FFFFFF",
        },
      },
      borderRadius: {
        "4xl": "28px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.06)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.10)",
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "bounce-soft": "bounce-soft 0.6s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
