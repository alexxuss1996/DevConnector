import { describe, expect, it } from "vitest";
import { system } from "./theme";

/**
 * Chakra's global CSS paints every `::placeholder` with `fg.muted/80`. A theme
 * that only defines a flat `fg` token leaves that path unresolved, the browser
 * drops the declaration, and placeholders inherit full-strength text colour —
 * they read as typed values. Asserted here because the failure is a silent
 * colour regression with no build or type error.
 */
describe("theme tokens", () => {
  const tokenNames = new Set(
    (system.tokens as unknown as { allTokens: { name: string }[] }).allTokens.map(
      (t) => t.name,
    ),
  );

  it.each(["colors.fg", "colors.fg.muted"])(
    "resolves %s to a CSS variable",
    (name) => {
      expect(tokenNames.has(name)).toBe(true);
    },
  );
});
