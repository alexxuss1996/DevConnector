import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Radio, RadioGroup } from "@/components/ui/radio";

const meta: Meta<typeof RadioGroup> = {
  title: "UI/Radio",
  component: RadioGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: (args) => (
    <RadioGroup {...args} defaultValue="react">
      <Radio value="react">React</Radio>
      <Radio value="vue">Vue</Radio>
      <Radio value="svelte">Svelte</Radio>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <RadioGroup {...args} defaultValue="react" disabled>
      <Radio value="react">React</Radio>
      <Radio value="vue">Vue</Radio>
    </RadioGroup>
  ),
};
