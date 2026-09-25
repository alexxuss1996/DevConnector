import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CloseButton } from "./close-button";

const meta: Meta<typeof CloseButton> = {
  title: "UI/CloseButton",
  component: CloseButton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CloseButton>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      <CloseButton {...args} size="xs" />
      <CloseButton {...args} size="sm" />
      <CloseButton {...args} size="md" />
    </div>
  ),
};
