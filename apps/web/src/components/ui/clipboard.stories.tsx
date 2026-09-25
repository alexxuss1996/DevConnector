import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ClipboardButton,
  ClipboardInput,
  ClipboardLabel,
  ClipboardLink,
  ClipboardRoot,
} from "./clipboard";

const meta: Meta<typeof ClipboardRoot> = {
  title: "UI/Clipboard",
  component: ClipboardRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ClipboardRoot>;

export const Default: Story = {
  render: (args) => (
    <ClipboardRoot {...args} value="npm i devconnector">
      <ClipboardLabel>Install</ClipboardLabel>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ClipboardInput />
        <ClipboardButton />
      </div>
    </ClipboardRoot>
  ),
};

export const AsLink: Story = {
  render: (args) => (
    <ClipboardRoot {...args} value="https://example.com/share">
      <ClipboardLink />
    </ClipboardRoot>
  ),
};
