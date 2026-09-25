import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tag } from "./tag";

const meta: Meta<typeof Tag> = {
  title: "UI/Tag",
  component: Tag,
  tags: ["autodocs"],
  args: { children: "New" },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Solid: Story = { args: { variant: "solid" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Subtle: Story = { args: { variant: "subtle" } };
export const Closable: Story = {
  args: { onClose: () => undefined },
};
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Tag {...args} size="sm">
        Small
      </Tag>
      <Tag {...args} size="md">
        Medium
      </Tag>
      <Tag {...args} size="lg">
        Large
      </Tag>
    </div>
  ),
};
