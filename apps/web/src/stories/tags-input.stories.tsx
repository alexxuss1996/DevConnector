import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "../components/ui/field";
import { TagsInputControl, TagsInputRoot } from "../components/ui/tags-input";

const meta: Meta<typeof TagsInputRoot> = {
  title: "UI/TagsInput",
  component: TagsInputRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TagsInputRoot>;

export const Default: Story = {
  render: (args) => (
    <TagsInputRoot {...args} defaultValue={["react", "nextjs"]}>
      <TagsInputControl />
    </TagsInputRoot>
  ),
};

export const Clearable: Story = {
  render: (args) => (
    <TagsInputRoot {...args} defaultValue={["react", "nextjs"]}>
      <TagsInputControl clearable />
    </TagsInputRoot>
  ),
};

export const WithField: Story = {
  render: (args) => (
    <Field label="Skills" helperText="Press Enter to add.">
      <TagsInputRoot {...args} defaultValue={["react"]}>
        <TagsInputControl />
      </TagsInputRoot>
    </Field>
  ),
};
