import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Blockquote, BlockquoteIcon } from "@/components/ui/blockquote";

const meta: Meta<typeof Blockquote> = {
  title: "UI/Blockquote",
  component: Blockquote,
  tags: ["autodocs"],
  args: { children: "Simplicity is the soul of efficiency." },
};

export default meta;
type Story = StoryObj<typeof Blockquote>;

export const Default: Story = {};

export const WithCite: Story = {
  args: { cite: "Austin Freeman", showDash: true },
};

export const WithIcon: Story = {
  args: {
    cite: "Austin Freeman",
    showDash: true,
    icon: <BlockquoteIcon />,
  },
};
