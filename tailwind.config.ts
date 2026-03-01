import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        s1: "#111111",
        s2: "#161616",
        s3: "#1E1E1E",
        s4: "#252525",
        border: "#2A2A2A",
        lime: "#C4CDD8",
        "lime-dim": "#C4CDD860",
        sub: "#737373",
        dark: "#0C0C0C",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
      },
      fontSize: {
        "10": ["10px", { lineHeight: "14px" }],
        "11": ["11px", { lineHeight: "15px" }],
      },
      letterSpacing: {
        wide2: "0.2em",
        wide18: "0.18em",
        tight1: "-0.01em",
        tight15: "-0.015em",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease forwards",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
} satisfies Config;
