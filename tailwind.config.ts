import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        canvas: "#F7F7F5",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#1F2328", soft: "#3D434B", muted: "#646B74", faint: "#8B929A" },
        line: { DEFAULT: "#E3E5E8", strong: "#CDD1D6" },
        accent: { DEFAULT: "#1F4E79", soft: "#E8EEF5", strong: "#163A5B" },
        ok: { DEFAULT: "#2F6B4F", soft: "#E7F1EC" },
        warn: { DEFAULT: "#9A6200", soft: "#FBF1DE" },
        bad: { DEFAULT: "#A23B32", soft: "#F8E8E6" },
      },
      borderRadius: { md: "6px", lg: "8px" },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,0.04)" },
      gridTemplateColumns: { 15: "repeat(15, minmax(0, 1fr))" },
    },
  },
  plugins: [],
};
export default config;
