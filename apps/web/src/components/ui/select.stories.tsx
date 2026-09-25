import { createListCollection } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "./select";

const meta: Meta<typeof SelectRoot> = {
  title: "UI/Select",
  component: SelectRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SelectRoot>;

const frameworks = createListCollection({
  items: [
    { label: "React", value: "react" },
    { label: "Vue", value: "vue" },
    { label: "Svelte", value: "svelte" },
  ],
});

export const Default: Story = {
  render: (args) => (
    <SelectRoot {...args} collection={frameworks} defaultValue={["react"]}>
      <SelectTrigger>
        <SelectValueText placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        {frameworks.items.map((item) => (
          <SelectItem key={item.value} item={item}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <SelectRoot {...args} collection={frameworks}>
      <SelectLabel>Framework</SelectLabel>
      <SelectTrigger>
        <SelectValueText placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        {frameworks.items.map((item) => (
          <SelectItem key={item.value} item={item}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  ),
};

export const Clearable: Story = {
  render: (args) => (
    <SelectRoot {...args} collection={frameworks} defaultValue={["vue"]}>
      <SelectTrigger clearable>
        <SelectValueText placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        {frameworks.items.map((item) => (
          <SelectItem key={item.value} item={item}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  ),
};
