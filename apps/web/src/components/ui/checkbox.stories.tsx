import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";
import { Field } from "./field";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { children: "Accept terms" },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const WithField: Story = {
  render: (args) => (
    <Field label="Preferences" helperText="Choose wisely.">
      <Checkbox {...args}>Email me updates</Checkbox>
    </Field>
  ),
};
