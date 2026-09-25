import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "../components/ui/progress-circle";

const meta: Meta<typeof ProgressCircleRoot> = {
  title: "UI/ProgressCircle",
  component: ProgressCircleRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ProgressCircleRoot>;

export const Default: Story = {
  render: (args) => (
    <ProgressCircleRoot {...args} value={60}>
      <ProgressCircleRing />
      <ProgressCircleValueText />
    </ProgressCircleRoot>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ProgressCircleRoot {...args} value={60} size="sm">
        <ProgressCircleRing />
      </ProgressCircleRoot>
      <ProgressCircleRoot {...args} value={60} size="md">
        <ProgressCircleRing />
      </ProgressCircleRoot>
      <ProgressCircleRoot {...args} value={60} size="lg">
        <ProgressCircleRing />
      </ProgressCircleRoot>
    </div>
  ),
};
