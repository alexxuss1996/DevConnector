import { Input } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LuSearch, LuUser } from "react-icons/lu";
import { InputGroup } from "@/components/ui/input-group";

const meta: Meta<typeof InputGroup> = {
  title: "UI/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InputGroup>;

export const StartElement: Story = {
  render: (args) => (
    <InputGroup {...args} startElement={<LuSearch />}>
      <Input placeholder="Search…" />
    </InputGroup>
  ),
};

export const EndElement: Story = {
  render: (args) => (
    <InputGroup {...args} endElement={<LuUser />}>
      <Input placeholder="Username" />
    </InputGroup>
  ),
};

export const Addons: Story = {
  render: (args) => (
    <InputGroup {...args} startAddon="https://" endAddon=".com">
      <Input placeholder="example" />
    </InputGroup>
  ),
};
