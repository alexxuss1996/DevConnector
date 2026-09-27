import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPageText,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination";

const meta: Meta<typeof PaginationRoot> = {
  title: "UI/Pagination",
  component: PaginationRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PaginationRoot>;

export const Default: Story = {
  render: (args) => (
    <PaginationRoot {...args} count={100} pageSize={10} defaultPage={1}>
      <PaginationPrevTrigger />
      <PaginationItems />
      <PaginationNextTrigger />
    </PaginationRoot>
  ),
};

export const WithPageText: Story = {
  render: (args) => (
    <PaginationRoot {...args} count={100} pageSize={10} defaultPage={2}>
      <PaginationPrevTrigger />
      <PaginationPageText />
      <PaginationNextTrigger />
    </PaginationRoot>
  ),
};
