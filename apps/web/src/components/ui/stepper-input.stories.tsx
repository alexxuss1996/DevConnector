import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StepperInput } from "./stepper-input";

const meta: Meta<typeof StepperInput> = {
  title: "UI/StepperInput",
  component: StepperInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StepperInput>;

export const Default: Story = { args: { defaultValue: "1" } };
export const WithLabel: Story = {
  args: { defaultValue: "1", label: "Guests" },
};
export const Disabled: Story = { args: { defaultValue: "1", disabled: true } };
