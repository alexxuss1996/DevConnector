import { Box } from "@chakra-ui/react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  ColorModeButton,
  ColorModeIcon,
  DarkMode,
  LightMode,
  useColorMode,
} from "@/components/ui/color-mode";

const meta: Meta = {
  title: "UI/ColorMode",
  tags: ["autodocs"],
};

export default meta;

function ThemedBox() {
  const { colorMode } = useColorMode();
  return (
    <Box bg={colorMode === "dark" ? "gray.800" : "gray.100"} p="4" borderRadius="md">
      Current mode: {colorMode}
    </Box>
  );
}

export const ToggleButton = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ColorModeButton />
      <ThemedBox />
    </div>
  ),
};

export const Icons = {  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ColorModeIcon />
      <LightMode>
        <span>forced light</span>
      </LightMode>
      <DarkMode>
        <span>forced dark</span>
      </DarkMode>
    </div>
  ),
};
