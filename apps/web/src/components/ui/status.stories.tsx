import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Status } from "./status";

const meta: Meta<typeof Status> = {
  title: "UI/Status",
  component: Status,
  tags: ["autodocs"],
  args: { children: "Active" },
};

export default meta;
type Story = StoryObj<typeof Status>;

export const AllStatuses: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12 }}>
      <Status {...args} value="success">
        Active
      </Status>
      <Status {...args} value="error">
        Failed
      </Status>
      <Status {...args} value="warning">
        Pending
      </Status>
      <Status {...args} value="info">
        Info
      </Status>
    </div>
  ),
};
