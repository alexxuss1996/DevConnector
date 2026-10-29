import { expect, test } from "vitest";
import { system } from "@/theme";

test("stitch theme tokens", () => {
  expect(system.token("colors.blue.600")).toBe("#005cb8");
  expect(system.token("colors.blue.700")).toBe("#00458d");
  expect(system.token("colors.primary.600")).toBe("#005cb8");
  expect(system.token("fonts.heading")).toContain("--font-inter");
  expect(system.token("colors.muted")).toBe("var(--chakra-colors-muted)");
});
