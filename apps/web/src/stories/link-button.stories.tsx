import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LinkButton } from "@/components/ui/link-button";

const meta: Meta<typeof LinkButton> = {
  title: "UI/LinkButton",
  component: LinkButton,
  tags: ["autodocs"],
  args: { href: "https://chakra-ui.com", children: "Learn more" },
};

export default meta;
type Story = StoryObj<typeof LinkButton>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      <LinkButton {...args} variant="solid">
        Solid
      </LinkButton>
      <LinkButton {...args} variant="outline">
        Outline
      </LinkButton>
      <LinkButton {...args} variant="ghost">
        Ghost
      </LinkButton>
    </div>
  ),
};
