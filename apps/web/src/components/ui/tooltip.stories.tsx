import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: { content: "Helpful hint", children: <Button>Hover me</Button> },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  args: { positioning: { placement: "top" }, showArrow: true },
};

export const Bottom: Story = {
  args: { positioning: { placement: "bottom" }, showArrow: true },
};

export const Disabled: Story = { args: { disabled: true } };
