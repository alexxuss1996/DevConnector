import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuItemGroup,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

const meta: Meta<typeof MenuRoot> = {
  title: "UI/Menu",
  component: MenuRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MenuRoot>;

export const Default: Story = {
  render: (args) => (
    <MenuRoot {...args}>
      <MenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem value="new">New file</MenuItem>
        <MenuItem value="open" disabled>
          Open (disabled)
        </MenuItem>
        <MenuSeparator />
        <MenuItem value="save">Save</MenuItem>
      </MenuContent>
    </MenuRoot>
  ),
};

export const WithGroups: Story = {
  render: (args) => {
    const [notify, setNotify] = React.useState(true);
    return (
      <MenuRoot {...args}>
        <MenuTrigger asChild>
          <Button variant="outline">Options</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItemGroup title="Actions">
            <MenuCheckboxItem
              value="notify"
              checked={notify}
              onCheckedChange={(checked) => setNotify(checked)}
            >
              Notify me
            </MenuCheckboxItem>
          </MenuItemGroup>
          <MenuSeparator />
          <MenuRadioItemGroup value="day" title="View">
            <MenuRadioItem value="day">Day</MenuRadioItem>
            <MenuRadioItem value="week">Week</MenuRadioItem>
          </MenuRadioItemGroup>
        </MenuContent>
      </MenuRoot>
    );
  },
};
