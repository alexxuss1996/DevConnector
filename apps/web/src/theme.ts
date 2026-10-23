import { createSystem, defaultConfig } from "@chakra-ui/react";

/**
 * Chakra's stock theme.
 *
 * Kept as the single entry point the provider imports so a custom theme can be
 * layered back in later without touching every consumer.
 */
export const system = createSystem(defaultConfig);
