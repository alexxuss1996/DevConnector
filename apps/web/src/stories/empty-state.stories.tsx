import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LuSearch } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: { title: "No results found" },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "Try adjusting your search or filters." },
};

export const WithIconAndAction: Story = {
  args: {
    description: "Try adjusting your search or filters.",
    icon: <LuSearch />,
  },
  render: (args) => (
    <EmptyState {...args}>
      <Button variant="outline">Clear filters</Button>
    </EmptyState>
  ),
};
