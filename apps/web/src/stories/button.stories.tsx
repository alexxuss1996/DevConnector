import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LuDownload } from "react-icons/lu";
import { Button } from "../components/ui/button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Click me" },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Solid: Story = { args: { variant: "solid" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Subtle: Story = { args: { variant: "subtle" } };
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Button {...args} size="xs">
        XS
      </Button>
      <Button {...args} size="sm">
        SM
      </Button>
      <Button {...args} size="md">
        MD
      </Button>
      <Button {...args} size="lg">
        LG
      </Button>
    </div>
  ),
};
export const Loading: Story = { args: { loading: true, children: "Saving…" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithIcon: Story = {
  args: {
    colorPalette: "blue",
    children: (
      <>
        <LuDownload /> Download
      </>
    ),
  },
};
export const AsChildLink: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="https://chakra-ui.com">Chakra UI</a>
    </Button>
  ),
};
