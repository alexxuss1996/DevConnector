import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton, SkeletonCircle, SkeletonText } from "../components/ui/skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: (args) => <Skeleton {...args} height="5" width="full" />,
};

export const Loaded: Story = {
  render: (args) => (
    <Skeleton {...args} loading={false}>
      Content is visible
    </Skeleton>
  ),
};

export const Circle: Story = {
  render: () => <SkeletonCircle size="12" />,
};

export const Text: Story = {
  render: () => <SkeletonText noOfLines={4} />,
};
