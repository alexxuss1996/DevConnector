import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../components/ui/button";
import {
  PopoverBody,
  PopoverCloseTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "../components/ui/popover";

const meta: Meta<typeof PopoverRoot> = {
  title: "UI/Popover",
  component: PopoverRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PopoverRoot>;

export const Default: Story = {
  render: (args) => (
    <PopoverRoot {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Notifications</PopoverTitle>
        <PopoverBody>You have 3 unread messages.</PopoverBody>
        <PopoverCloseTrigger />
      </PopoverContent>
    </PopoverRoot>
  ),
};
