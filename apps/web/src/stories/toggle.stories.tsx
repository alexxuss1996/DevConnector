import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LuBold } from "react-icons/lu";
import { Toggle } from "@/components/ui/toggle";

const meta: Meta<typeof Toggle> = {
  title: "UI/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: { children: <LuBold /> },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Off: Story = {};
export const On: Story = { args: { defaultPressed: true } };
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Toggle {...args} variant="solid">
        <LuBold />
      </Toggle>
      <Toggle {...args} variant="surface">
        <LuBold />
      </Toggle>
      <Toggle {...args} variant="subtle">
        <LuBold />
      </Toggle>
      <Toggle {...args} variant="ghost">
        <LuBold />
      </Toggle>
    </div>
  ),
};
