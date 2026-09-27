import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Splitter,
  SplitterPanel,
  SplitterResizeTrigger,
} from "@/components/ui/splitter";

const meta: Meta<typeof Splitter> = {
  title: "UI/Splitter",
  component: Splitter,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Splitter>;

const panelStyle = {
  padding: 12,
  border: "1px solid var(--chakra-colors-border)",
  borderRadius: 8,
} as const;

export const Horizontal: Story = {
  render: (args) => (
    <Splitter {...args} defaultSize={["50%", "50%"]}>
      <SplitterPanel id="a" style={panelStyle}>
        Panel A
      </SplitterPanel>
      <SplitterResizeTrigger id="a:b" aria-label="Resize" />
      <SplitterPanel id="b" style={panelStyle}>
        Panel B
      </SplitterPanel>
    </Splitter>
  ),
};

export const Vertical: Story = {
  render: (args) => (
    <Splitter {...args} orientation="vertical" defaultSize={["50%", "50%"]}>
      <SplitterPanel id="a" style={panelStyle}>
        Panel A
      </SplitterPanel>
      <SplitterResizeTrigger id="a:b" aria-label="Resize" />
      <SplitterPanel id="b" style={panelStyle}>
        Panel B
      </SplitterPanel>
    </Splitter>
  ),
};
