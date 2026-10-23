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
        // ── Surface / Elevation scale ──────────────────────────────────────
        "surface-0": "var(--surface-0)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",

        gold: "var(--gold)",
        "gold-hover": "var(--gold-hover)",
        "gold-muted": "var(--gold-muted)",
        emerald: "var(--emerald)",
        "emerald-muted": "var(--emerald-muted)",
        "accent-emerald": "var(--emerald)",
        teal: "var(--teal)",

        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "text-inverse": "var(--text-inverse)",

        // Skeleton / loading placeholder tokens
        "skeleton-base": "var(--skeleton-base)",
        "skeleton-sheen": "var(--skeleton-sheen)",

        // Status chip tokens
        "status-success": "var(--status-success)",
        "status-warning": "var(--status-warning)",
        "status-danger": "var(--status-danger)",
        "status-info": "var(--status-info)",
        "status-locked": "var(--status-locked)",
        "status-draft": "var(--status-draft)",

        // Canonical surface/elevated/card tokens. One name per token:
        // bg-surface-* for the elevation scale, bg-card for the card fill.
        card: "var(--surface-1)",
        elevated: "var(--surface-2)",
        "bg-elevated": "var(--surface-2)",
        "bg-card": "var(--surface-1)",

        // Semantic status aliases used by the *State components. These map the
        // short names (bg-danger, text-warning, ...) onto the same CSS variables
        // as the status-* scale so one token drives both spellings.
        danger: "var(--status-danger)",
        warning: "var(--status-warning)",
        success: "var(--status-success)",
        info: "var(--status-info)",

        // Semantic aliases for body copy and the muted surface fill.
        content: "var(--text-primary)",
        "surface-variant": "var(--surface-2)",

        // Accent aliases used by the error boundaries and dev fixtures.
        "accent-gold": "var(--gold)",
        "accent-gold-hover": "var(--gold-hover)",
        "accent-teal": "#14B8A6",

        // ── Border tokens — elevation-aware ───────────────────────────────
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-raised": "var(--border-raised)",
        "border-hover": "var(--border-hover)",
        "border-focus": "var(--border-focus)",
      },
      backgroundColor: {
        // Surface scale
        "surface-0": "var(--surface-0)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        // Legacy aliases
        card: "var(--surface-1)",
        elevated: "var(--surface-2)",
        "bg-elevated": "var(--surface-2)",
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        inverse: "var(--text-inverse)",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        default: "var(--border-default)",
        raised: "var(--border-raised)",
        hover: "var(--border-hover)",
        focus: "var(--border-focus)",
      },
      ringColor: {
        DEFAULT: "var(--border-focus)",
        focus: "var(--border-focus)",
        "focus-high-contrast": "var(--gold)",
        "focus-danger": "var(--status-danger)",
        "focus-emerald": "var(--emerald)",
      },
      ringOffsetColor: {
        DEFAULT: "var(--surface-0)",
        surface: "var(--surface-1)",
        elevated: "var(--surface-2)",
      },
      ringWidth: {
        DEFAULT: "2px",
        focus: "2px",
        "focus-hc": "3px",
      },
      ringOffsetWidth: {
        DEFAULT: "2px",
        focus: "2px",
      },
      // ── Elevation / shadow scale ─────────────────────────────────────────
      boxShadow: {
        "elev-0": "none",
        "elev-1": "var(--shadow-elev-1)",
        "elev-2": "var(--shadow-elev-2)",
        "elev-3": "var(--shadow-elev-3)",
        "focus-ring": "0 0 0 2px var(--surface-0), 0 0 0 4px var(--border-focus)",
        "focus-ring-hc": "0 0 0 2px var(--surface-0), 0 0 0 5px var(--gold)",
        // Legacy aliases
        card: "var(--shadow-elev-1)",
        "card-hover": "var(--shadow-elev-2)",
        "glow-gold": "var(--amana-shadow-glow-gold)",
        "glow-emerald": "var(--amana-shadow-glow-emerald)",
        modal: "var(--shadow-elev-3)",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        15: "60px",
        20: "80px",
        30: "120px",
        36: "144px",
        84: "336px",
        104: "416px",
        120: "480px",
        176: "704px",
      },
      borderRadius: {
        none: "var(--amana-radius-none)",
        sm: "var(--amana-radius-sm)",
        md: "var(--amana-radius-md)",
        lg: "var(--amana-radius-lg)",
        xl: "var(--amana-radius-xl)",
        "2xl": "var(--amana-radius-2xl)",
        full: "var(--amana-radius-full)",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "var(--amana-font-family-sans)",
        ],
        manrope: ["var(--font-manrope)", "var(--amana-font-family-manrope)"],
        mono: [
          "var(--font-geist-mono)",
          "var(--amana-font-family-mono)",
        ],
      },
      fontSize: {
        xs: ["var(--amana-font-size-xs)", { lineHeight: "var(--amana-line-height-normal)" }],
        sm: ["var(--amana-font-size-sm)", { lineHeight: "var(--amana-line-height-normal)" }],
        base: ["var(--amana-font-size-base)", { lineHeight: "var(--amana-line-height-normal)" }],
        lg: ["var(--amana-font-size-lg)", { lineHeight: "var(--amana-line-height-large)" }],
        xl: ["var(--amana-font-size-xl)", { lineHeight: "var(--amana-line-height-compact)" }],
        "2xl": ["var(--amana-font-size-2xl)", { lineHeight: "var(--amana-line-height-subheading)" }],
        "3xl": ["var(--amana-font-size-3xl)", { lineHeight: "var(--amana-line-height-heading)" }],
        "4xl": ["var(--amana-font-size-4xl)", { lineHeight: "var(--amana-line-height-tight)" }],
        "5xl": ["var(--amana-font-size-5xl)", { lineHeight: "var(--amana-line-height-hero)" }],
        display: ["var(--amana-font-size-display)", { lineHeight: "var(--amana-line-height-display)", letterSpacing: "var(--amana-letter-spacing-tight)" }],
      },
      lineHeight: {
        tight: "var(--amana-line-height-tight)",
        normal: "var(--amana-line-height-normal)",
        relaxed: "var(--amana-line-height-relaxed)",
      },
      backgroundImage: {
        "gradient-hero": "var(--amana-gradient-hero)",
        "gradient-gold-cta": "var(--amana-gradient-gold-cta)",
        "gradient-card-glow": "var(--amana-gradient-card-glow)",
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "skeleton-pulse": "skeleton-pulse 1.6s ease-in-out infinite",
        "skeleton-shimmer": "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
