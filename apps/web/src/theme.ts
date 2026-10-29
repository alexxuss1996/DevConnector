import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * Theme from the Stitch "DevConnector Frontend Redesign" design-system screens:
 * blue primary #005cb8, Inter headings/body, JetBrains Mono code, hairline
 * surfaces. Light values come from the light screen, dark values from the
 * "Design System & Component Library (Dark Mode)" screen.
 *
 * `blue` stays as an alias of `primary` because existing components already use
 * `colorPalette="blue"` / `blue.solid` for every action.
 */
const primaryScale = {
  50: { value: "#eef4ff" },
  100: { value: "#d6e3ff" },
  200: { value: "#aac7ff" },
  300: { value: "#7fa9ff" },
  400: { value: "#4a8dfa" },
  500: { value: "#1275e2" },
  600: { value: "#005cb8" },
  700: { value: "#00458d" },
  800: { value: "#00326a" },
  900: { value: "#001b3e" },
  950: { value: "#000d24" },
};

// 50, 300, 400 and 950 are interpolated; the screen only defines the M3 roles.
const primarySemantic = {
  solid: { value: { _light: "#005cb8", _dark: "#3b82f6" } },
  contrast: { value: { _light: "#ffffff", _dark: "#ffffff" } },
  fg: { value: { _light: "#00458d", _dark: "#60a5fa" } },
  subtle: { value: { _light: "#d6e3ff", _dark: "#1e3a8a" } },
  muted: { value: { _light: "#aac7ff", _dark: "#1d4ed8" } },
  emphasized: { value: { _light: "#1275e2", _dark: "#1d4ed8" } },
  focusRing: { value: { _light: "#005cb8", _dark: "#3b82f6" } },
};

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        primary: primaryScale,
        blue: primaryScale,
      },
      fonts: {
        heading: { value: "var(--font-inter), system-ui, sans-serif" },
        body: { value: "var(--font-inter), system-ui, sans-serif" },
        mono: {
          value:
            "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace",
        },
      },
      radii: {
        md: { value: "0.25rem" },
        lg: { value: "0.5rem" },
        xl: { value: "0.75rem" },
        full: { value: "9999px" },
      },
      spacing: {
        gutter: { value: "1.5rem" },
        margin: { value: "2rem" },
        "space-xs": { value: "0.25rem" },
        "space-sm": { value: "0.5rem" },
        "space-md": { value: "1rem" },
        "space-lg": { value: "1.5rem" },
        "space-xl": { value: "2.5rem" },
      },
    },
    semanticTokens: {
      colors: {
        primary: primarySemantic,
        blue: primarySemantic,
        bg: {
          DEFAULT: { value: { _light: "#f9f9ff", _dark: "#090d16" } },
          subtle: { value: { _light: "#f1f3fc", _dark: "#0f172a" } },
          muted: { value: { _light: "#ebedf7", _dark: "#131c2e" } },
          emphasized: { value: { _light: "#e0e2eb", _dark: "#223049" } },
          panel: { value: { _light: "#ffffff", _dark: "#0b0f19" } },
        },
        fg: {
          DEFAULT: { value: { _light: "#181c22", _dark: "#f8fafc" } },
          muted: { value: { _light: "#414753", _dark: "#94a3b8" } },
          subtle: { value: { _light: "#717785", _dark: "#64748b" } },
        },
        border: {
          DEFAULT: { value: { _light: "#c1c6d5", _dark: "#1e293b" } },
          muted: { value: { _light: "#e0e2eb", _dark: "#131c2e" } },
          subtle: { value: { _light: "#f1f3fc", _dark: "#0f172a" } },
          emphasized: { value: { _light: "#717785", _dark: "#334155" } },
        },
        // Flat alias used by existing `color="muted"` call sites.
        muted: { value: { _light: "#414753", _dark: "#94a3b8" } },
      },
    },
    textStyles: {
      "headline-lg": {
        value: { fontSize: "32px", lineHeight: "40px", fontWeight: "600" },
      },
      "headline-md": {
        value: { fontSize: "24px", lineHeight: "32px", fontWeight: "600" },
      },
      "headline-sm": {
        value: { fontSize: "20px", lineHeight: "28px", fontWeight: "500" },
      },
      "body-lg": {
        value: { fontSize: "16px", lineHeight: "24px", fontWeight: "400" },
      },
      "body-md": {
        value: { fontSize: "14px", lineHeight: "20px", fontWeight: "400" },
      },
      "body-sm": {
        value: { fontSize: "12px", lineHeight: "16px", fontWeight: "400" },
      },
      "label-lg": {
        value: { fontSize: "14px", lineHeight: "20px", fontWeight: "500" },
      },
      "label-md": {
        value: { fontSize: "12px", lineHeight: "16px", fontWeight: "500" },
      },
      "label-sm": {
        value: { fontSize: "11px", lineHeight: "14px", fontWeight: "500" },
      },
      code: {
        value: {
          fontFamily: "mono",
          fontSize: "13px",
          lineHeight: "20px",
          fontWeight: "400",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
