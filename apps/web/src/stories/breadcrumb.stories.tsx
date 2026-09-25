import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  BreadcrumbCurrentLink,
  BreadcrumbEllipsis,
  BreadcrumbLink,
  BreadcrumbRoot,
} from "../components/ui/breadcrumb";

const meta: Meta<typeof BreadcrumbRoot> = {
  title: "UI/Breadcrumb",
  component: BreadcrumbRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BreadcrumbRoot>;

export const Default: Story = {
  render: (args) => (
    <BreadcrumbRoot {...args}>
      <BreadcrumbLink href="#">Home</BreadcrumbLink>
      <BreadcrumbLink href="#">Library</BreadcrumbLink>
      <BreadcrumbCurrentLink>Data</BreadcrumbCurrentLink>
    </BreadcrumbRoot>
  ),
};

export const WithEllipsis: Story = {
  render: (args) => (
    <BreadcrumbRoot {...args}>
      <BreadcrumbLink href="#">Home</BreadcrumbLink>
      <BreadcrumbEllipsis />
      <BreadcrumbLink href="#">Library</BreadcrumbLink>
      <BreadcrumbCurrentLink>Data</BreadcrumbCurrentLink>
    </BreadcrumbRoot>
  ),
};
