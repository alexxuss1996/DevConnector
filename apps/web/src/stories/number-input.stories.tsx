import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "@/components/ui/field";
import {
  NumberInputField,
  NumberInputLabel,
  NumberInputRoot,
  NumberInputScrubber,
} from "@/components/ui/number-input";

const meta: Meta<typeof NumberInputRoot> = {
  title: "UI/NumberInput",
  component: NumberInputRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof NumberInputRoot>;

export const Default: Story = {
  render: (args) => (
    <NumberInputRoot {...args} defaultValue="5" min={0} max={10}>
      <NumberInputField />
    </NumberInputRoot>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <NumberInputRoot {...args} defaultValue="5">
      <NumberInputLabel>Quantity</NumberInputLabel>
      <NumberInputField />
    </NumberInputRoot>
  ),
};

export const WithScrubber: Story = {
  render: (args) => (
    <Field label="Drag to change">
      <NumberInputRoot {...args} defaultValue="5">
        <NumberInputField />
        <NumberInputScrubber />
      </NumberInputRoot>
    </Field>
  ),
};
