import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  StepsCompletedContent,
  StepsContent,
  StepsItem,
  StepsList,
  StepsNextTrigger,
  StepsPrevTrigger,
  StepsRoot,
} from "@/components/ui/steps";

const meta: Meta<typeof StepsRoot> = {
  title: "UI/Steps",
  component: StepsRoot,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StepsRoot>;

export const Default: Story = {
  render: (args) => (
    <StepsRoot {...args} defaultStep={1} count={3}>
      <StepsList>
        <StepsItem index={0} title="Sign up" />
        <StepsItem index={1} title="Verify" />
        <StepsItem index={2} title="Done" />
      </StepsList>
      <StepsContent index={0}>Create your account.</StepsContent>
      <StepsContent index={1}>Check your inbox.</StepsContent>
      <StepsContent index={2}>You are all set.</StepsContent>
      <StepsCompletedContent>Finished!</StepsCompletedContent>
      <div style={{ display: "flex", gap: 8 }}>
        <StepsPrevTrigger asChild>
          <Button variant="outline">Back</Button>
        </StepsPrevTrigger>
        <StepsNextTrigger asChild>
          <Button>Next</Button>
        </StepsNextTrigger>
      </div>
    </StepsRoot>
  ),
};
