import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Rating } from "./rating";

const meta: Meta<typeof Rating> = {
  title: "UI/Rating",
  component: Rating,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Rating>;

export const Default: Story = { args: { defaultValue: 3 } };
export const WithLabel: Story = {
  args: { defaultValue: 4, label: "Rate this" },
};
export const ReadOnly: Story = { args: { defaultValue: 3, readOnly: true } };
