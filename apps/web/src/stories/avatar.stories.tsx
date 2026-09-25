import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar, AvatarGroup } from "../components/ui/avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithImage: Story = {
  args: { name: "Alex", src: "https://i.pravatar.cc/150?img=3" },
};

export const Fallback: Story = { args: { name: "Alex Morgan" } };

export const Sizes: Story = {
  render: (args) => (
    <AvatarGroup>
      <Avatar {...args} name="Alex" size="xs" />
      <Avatar {...args} name="Sam" size="sm" />
      <Avatar {...args} name="Jo" size="md" />
      <Avatar {...args} name="Kim" size="lg" />
    </AvatarGroup>
  ),
};

export const Group: Story = {
  render: (args) => (
    <AvatarGroup>
      <Avatar {...args} name="Alex Morgan" />
      <Avatar {...args} name="Sam Lee" />
      <Avatar {...args} name="Jo Kim" />
    </AvatarGroup>
  ),
};
