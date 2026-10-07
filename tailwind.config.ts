import type { Config } from "tailwindcss";

/**
 * FirstGear Compass design tokens — a deliberately small palette:
 * neutrals for structure, one accent for action and focus, and three muted
 * status colours used only to signal state (always paired with an icon).
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        canvas: "#F7F7F8",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#18181B", soft: "#3F3F46", muted: "#71717A", faint: "#A1A1AA" },
        line: { DEFAULT: "#EAEAEC", strong: "#D9D9DE" },
        accent: { DEFAULT: "#2F55B4", soft: "#EEF2FB", strong: "#244394" },
        ok: { DEFAULT: "#2F7A4F", soft: "#EEF6F1" },
        warn: { DEFAULT: "#A25E0B", soft: "#FBF5EA" },
        bad: { DEFAULT: "#B4382E", soft: "#FBEFEE" },
      },
      borderRadius: { md: "8px", lg: "12px" },
      boxShadow: { card: "none", pop: "0 8px 24px rgba(24,24,27,0.08)" },
      gridTemplateColumns: { 15: "repeat(15, minmax(0, 1fr))" },
    },
  },
  plugins: [],
};
export default config;
