import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";

const meta: Meta<typeof AccordionRoot> = {
  title: "UI/Accordion",
  component: AccordionRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AccordionRoot>;

export const Default: Story = {
  render: (args) => (
    <AccordionRoot {...args} defaultValue={["a"]}>
      <AccordionItem value="a">
        <AccordionItemTrigger>What is this?</AccordionItemTrigger>
        <AccordionItemContent>
          An accordion section with more details.
        </AccordionItemContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionItemTrigger>How does it work?</AccordionItemTrigger>
        <AccordionItemContent>Click a trigger to expand.</AccordionItemContent>
      </AccordionItem>
    </AccordionRoot>
  ),
};

export const StartIndicator: Story = {
  render: (args) => (
    <AccordionRoot {...args} defaultValue={["a"]}>
      <AccordionItem value="a">
        <AccordionItemTrigger indicatorPlacement="start">
          Indicator first
        </AccordionItemTrigger>
        <AccordionItemContent>Details here.</AccordionItemContent>
      </AccordionItem>
    </AccordionRoot>
  ),
};
