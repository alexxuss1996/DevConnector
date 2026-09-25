import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExampleForm } from "./ExampleForm";

const meta: Meta<typeof ExampleForm> = {
  title: "Forms/ExampleForm",
  component: ExampleForm,
  tags: ["autodocs"],
  args: {
    onSubmit: (values) => {
      console.log("submitted", values);
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExampleForm>;

export const Default: Story = {};
