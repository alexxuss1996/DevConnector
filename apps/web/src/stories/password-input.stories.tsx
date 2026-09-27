import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "@/components/ui/field";
import { PasswordInput, PasswordStrengthMeter } from "@/components/ui/password-input";

const meta: Meta<typeof PasswordInput> = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PasswordInput>;

export const Default: Story = {
  args: { placeholder: "Enter password" },
};

export const WithField: Story = {
  render: (args) => (
    <Field label="Password" helperText="At least 8 characters.">
      <PasswordInput {...args} placeholder="Enter password" />
    </Field>
  ),
};

export const WithStrengthMeter: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <PasswordInput {...args} defaultValue="s3cret!" />
      <PasswordStrengthMeter value={2} />
    </div>
  ),
};
