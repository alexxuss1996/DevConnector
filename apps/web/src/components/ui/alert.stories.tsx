import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: { title: "Heads up" },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const AllStatuses: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 8 }}>
      <Alert {...args} status="success" title="Success">
        Everything worked.
      </Alert>
      <Alert {...args} status="error" title="Error">
        Something went wrong.
      </Alert>
      <Alert {...args} status="warning" title="Warning">
        Check this before continuing.
      </Alert>
      <Alert {...args} status="info" title="Info">
        For your information.
      </Alert>
    </div>
  ),
};

export const TitleOnly: Story = {};
