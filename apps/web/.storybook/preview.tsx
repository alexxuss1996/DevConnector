import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Preview } from "@storybook/nextjs-vite";
import * as React from "react";
import { ColorModeProvider } from "../src/components/ui/color-mode";

const preview: Preview = {
  parameters: { controls: { expanded: true } },
  decorators: [
    (Story) => (
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <Story />
        </ColorModeProvider>
      </ChakraProvider>
    ),
  ],
};

export default preview;
