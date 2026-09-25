import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "../components/ui/field";
import { NativeSelectField, NativeSelectRoot } from "../components/ui/native-select";

const meta: Meta<typeof NativeSelectRoot> = {
  title: "UI/NativeSelect",
  component: NativeSelectRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof NativeSelectRoot>;

const roles = ["Frontend", "Backend", "Fullstack"];

export const Default: Story = {
  render: (args) => (
    <NativeSelectRoot {...args}>
      <NativeSelectField items={roles} />
    </NativeSelectRoot>
  ),
};

export const WithField: Story = {
  render: (args) => (
    <Field label="Role">
      <NativeSelectRoot {...args}>
        <NativeSelectField items={roles} />
      </NativeSelectRoot>
    </Field>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <NativeSelectRoot {...args} disabled>
      <NativeSelectField items={roles} />
    </NativeSelectRoot>
  ),
};
