import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Prose } from "../components/ui/prose";

const meta: Meta<typeof Prose> = {
  title: "UI/Prose",
  component: Prose,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Prose>;

export const Default: Story = {
  render: (args) => (
    <Prose {...args}>
      <h1>Getting started</h1>
      <p>
        This is a paragraph with <strong>bold</strong>, <em>italic</em>,{" "}
        <code>code</code>, and a <a href="#">link</a>.
      </p>
      <h2>Lists</h2>
      <ul>
        <li>First item</li>
        <li>Second item</li>
      </ul>
      <blockquote>A wise quote.</blockquote>
    </Prose>
  ),
};

export const Large: Story = {
  render: (args) => (
    <Prose {...args} size="lg">
      <h1>Getting started</h1>
      <p>Larger body text for long-form reading.</p>
    </Prose>
  ),
};
