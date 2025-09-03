// Central color constants - single source of truth for all colors
export const COLORS = {
  // Primary brand colors
  PRIMARY: "#00D4AA",
  SUCCESS: "#00D4AA",

  // Status colors
  ERROR_LIGHT: "#FF5722",
  ERROR_DARK: "#FF6B6B",

  // Blue variants
  BLUE_BASE: "rgb(96, 165, 250)", // #60a5fa in RGB
  BLUE_TRANSPARENT_50: "rgba(96, 165, 250, 0.5)",
  BLUE_TRANSPARENT_20: "rgba(96, 165, 250, 0.2)",

  // Light theme colors
  LIGHT: {
    BACKGROUND: "#ffffff",
    SURFACE: "#f8f9fa",
    CARD: "#ffffff",
    TEXT: "#000000",
    TEXT_SECONDARY: "#6b7280",
    BORDER: "#e5e7eb",
  },

  // Dark theme colors
  DARK: {
    BACKGROUND: "#0a0a0a",
    SURFACE: "#1a1a1a",
    CARD: "#2a2a2a",
    TEXT: "#ffffff",
    TEXT_SECONDARY: "#888888",
    BORDER: "#333333",
  },

  // Semantic colors
  POSITIVE: "#10B981",
  NEGATIVE: "#EF4444",
  NEUTRAL: "#6b7280",

  // Common RGBA values used throughout the app
  OVERLAY_DARK: "rgba(0, 0, 0, 0.8)",
  OVERLAY_LIGHT: "rgba(0, 0, 0, 0.5)",
  WHITE_TRANSPARENT: "rgba(255, 255, 255, 0.2)",
} as const;

// Helper function to get blue with custom opacity
export const getBlueWithOpacity = (opacity: number) =>
  `rgba(96, 165, 250, ${opacity})`;

// Helper function to get any color with custom opacity
export const getColorWithOpacity = (rgb: string, opacity: number) => {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return rgb;
};
