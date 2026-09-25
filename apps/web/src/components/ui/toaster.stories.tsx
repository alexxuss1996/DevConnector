import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Toaster, toaster } from "./toaster";

const meta: Meta = {
  title: "UI/Toaster",
  tags: ["autodocs"],
};

export default meta;

export const Success = {
  render: () => (
    <div>
      <Toaster />
      <Button
        onClick={() =>
          toaster.success({ title: "Saved", description: "All changes saved." })
        }
      >
        Show success toast
      </Button>
    </div>
  ),
};

export const Error = {
  render: () => (
    <div>
      <Toaster />
      <Button
        colorPalette="red"
        onClick={() =>
          toaster.error({ title: "Failed", description: "Please try again." })
        }
      >
        Show error toast
      </Button>
    </div>
  ),
};
