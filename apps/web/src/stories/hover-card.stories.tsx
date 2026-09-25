import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../components/ui/button";
import {
  HoverCardContent,
  HoverCardRoot,
  HoverCardTrigger,
} from "../components/ui/hover-card";

const meta: Meta<typeof HoverCardRoot> = {
  title: "UI/HoverCard",
  component: HoverCardRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof HoverCardRoot>;

export const Default: Story = {
  render: (args) => (
    <HoverCardRoot {...args}>
      <HoverCardTrigger asChild>
        <Button variant="outline">@alex</Button>
      </HoverCardTrigger>
      <HoverCardContent>Alex — full-stack developer.</HoverCardContent>
    </HoverCardRoot>
  ),
};
