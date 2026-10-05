import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * DevConnector design tokens.
 *
 * Layered over Chakra's `defaultConfig` so every recipe already in
 * `components/ui` (Button, Field, Tag, Dialog) keeps working unchanged. This
 * only overrides colours, fonts and radii, and registers the single `brand`
 * palette the whole app draws from.
 *
 * Dark is the primary mode: the product is a developer tool. Light values are
 * defined per token so the site still reads correctly on a light OS, but there
 * is no per-section theme flip anywhere.
 *
 * The mode-aware colours live under `semanticTokens` rather than `tokens`
 * because conditional (`base` / `_dark`) values are only typed there.
 */
const config = defineConfig({
  globalCss: {
    // Pinning the palette at the root makes every default focus ring amber
    // instead of Chakra's stock blue, including on components we never touch.
    html: { colorPalette: "brand" },
    body: { bg: "canvas", color: "fg" },
  },
  theme: {
    tokens: {
      // One radius everywhere. Mixed corner systems read as broken design, so
      // the whole scale collapses to 6px rather than being picked per component.
      radii: {
        sm: { value: "6px" },
        md: { value: "6px" },
        lg: { value: "6px" },
        xl: { value: "6px" },
        "2xl": { value: "6px" },
        "3xl": { value: "6px" },
      },
    },
    semanticTokens: {
      colors: {
        /** Page background. */
        canvas: { value: { base: "#F6F7F9", _dark: "#0B0E11" } },
        /** Header, footer, cards. */
        panel: { value: { base: "#FFFFFF", _dark: "#11151A" } },
        /** Raised surfaces: composer, dialogs. */
        raised: { value: { base: "#FFFFFF", _dark: "#171C23" } },
        /** Every hairline on the site is this one token. */
        line: { value: { base: "#E2E6EC", _dark: "#232A33" } },
        /* `muted` nested under `fg`, not just a sibling: Chakra's global CSS
           styles every `::placeholder` with `fg.muted/80` and prose recipes ask
           for `fg.muted` directly. With only the flat `fg` token those paths
           resolve to nothing, so the browser fell back to inherited
           `color` and placeholders rendered at full strength — reading as
           typed values. `DEFAULT` keeps the bare `fg` path working. */
        fg: {
          DEFAULT: { value: { base: "#0C0F14", _dark: "#E6EDF3" } },
          muted: { value: { base: "#59626F", _dark: "#8B98A5" } },
        },
        muted: { value: { base: "#59626F", _dark: "#8B98A5" } },

        /* Chakra's stock focus ring points at a palette token that resolves to
           nothing here, which left every focusable control with a near-black
           outline on a near-black background. Pin it to the accent. */
        focusRing: { value: { base: "#B45309", _dark: "#FFA657" } },

        // Nested, not dotted keys: a literal "brand.solid" key does not emit a
        // `--chakra-colors-brand-solid` variable, which silently leaves every
        // `colorPalette="brand"` control with no background at all.
        brand: {
          solid: { value: { base: "#B45309", _dark: "#FFA657" } },
          fg: { value: { base: "#B45309", _dark: "#FFA657" } },
          contrast: { value: { base: "#FFFFFF", _dark: "#0C0F14" } },
          subtle: { value: { base: "#FFF6ED", _dark: "#1A140C" } },
          muted: { value: { base: "#FFE9D2", _dark: "#3A2A18" } },
          emphasized: { value: { base: "#FFDDB8", _dark: "#2A1E10" } },
          /* The focus ring resolves through the palette context, not the global
             focusRing token, so an unlisted palette falls back to `contrast`
             and draws a near-black outline on a near-black background. */
          focusRing: { value: { base: "#B45309", _dark: "#FFA657" } },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);