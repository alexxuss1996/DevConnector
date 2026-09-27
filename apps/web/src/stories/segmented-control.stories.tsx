import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SegmentedControl } from "@/components/ui/segmented-control";

const meta: Meta<typeof SegmentedControl> = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  args: { items: ["Day", "Week", "Month"] },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

export const Default: Story = { args: { defaultValue: "Week" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithDisabledItem: Story = {
  args: {
    defaultValue: "Day",
    items: ["Day", "Week", { value: "Month", label: "Month", disabled: true }],
  },
};
