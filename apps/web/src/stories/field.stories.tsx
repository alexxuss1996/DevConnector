import { Input } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "../components/ui/field";

const meta: Meta<typeof Field> = {
  title: "UI/Field",
  component: Field,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {
  args: { label: "Email", children: <Input placeholder="you@example.com" /> },
};

export const HelperText: Story = {
  args: {
    label: "Username",
    helperText: "Lowercase letters and numbers only.",
    children: <Input placeholder="alex" />,
  },
};

export const Required: Story = {
  args: {
    label: "Password",
    required: true,
    children: <Input type="password" />,
  },
};

export const Invalid: Story = {
  args: {
    label: "Email",
    invalid: true,
    errorText: "Enter a valid email address.",
    children: <Input defaultValue="not-an-email" />,
  },
};
