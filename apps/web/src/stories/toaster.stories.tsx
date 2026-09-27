import type { Meta } from "@storybook/nextjs-vite";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Toaster, toaster } from "@/components/ui/toaster";

const meta: Meta = {
  title: "UI/Toaster",
  tags: ["autodocs"],
};

export default meta;

function DismissOnUnmount({ children }: { children: React.ReactNode }) {
  React.useEffect(() => () => toaster.dismiss(), []);
  return <>{children}</>;
}

export const Success = {
  render: () => (
    <DismissOnUnmount>
      <Toaster />
      <Button
        onClick={() =>
          toaster.success({ title: "Saved", description: "All changes saved." })
        }
      >
        Show success toast
      </Button>
    </DismissOnUnmount>
  ),
};

export const Error = {
  render: () => (
    <DismissOnUnmount>
      <Toaster />
      <Button
        colorPalette="red"
        onClick={() =>
          toaster.error({ title: "Failed", description: "Please try again." })
        }
      >
        Show error toast
      </Button>
    </DismissOnUnmount>
  ),
};
