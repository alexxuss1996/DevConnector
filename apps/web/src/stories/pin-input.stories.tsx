import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "../components/ui/field";
import { PinInput } from "../components/ui/pin-input";

const meta: Meta<typeof PinInput> = {
  title: "UI/PinInput",
  component: PinInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PinInput>;

export const Default: Story = { args: { placeholder: "0" } };
export const SixDigits: Story = { args: { count: 6, placeholder: "0" } };
export const WithField: Story = {
  render: (args) => (
    <Field label="Verification code" helperText="Check your inbox.">
      <PinInput {...args} placeholder="0" />
    </Field>
  ),
};
