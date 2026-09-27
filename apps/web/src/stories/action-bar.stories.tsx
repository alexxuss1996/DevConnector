import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  ActionBarCloseTrigger,
  ActionBarContent,
  ActionBarRoot,
  ActionBarSelectionTrigger,
  ActionBarSeparator,
} from "@/components/ui/action-bar";

const meta: Meta<typeof ActionBarRoot> = {
  title: "UI/ActionBar",
  component: ActionBarRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ActionBarRoot>;

export const Open: Story = {
  render: (args) => (
    <ActionBarRoot {...args} open>
      <ActionBarContent>
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button variant="outline" size="sm">
          Delete
        </Button>
        <ActionBarSeparator />
        <ActionBarCloseTrigger />
      </ActionBarContent>
    </ActionBarRoot>
  ),
};

export const WithSelection: Story = {
  render: (args) => (
    <ActionBarRoot {...args} open>
      <ActionBarContent>
        <ActionBarSelectionTrigger>3 selected</ActionBarSelectionTrigger>
        <ActionBarSeparator />
        <Button variant="outline" size="sm">
          Delete
        </Button>
        <ActionBarCloseTrigger />
      </ActionBarContent>
    </ActionBarRoot>
  ),
};
