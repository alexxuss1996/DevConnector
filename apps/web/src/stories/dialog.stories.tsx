import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const meta: Meta = { title: "UI/Dialog", tags: ["autodocs"] };

export default meta;

export const Default = {
  render: () => (
    <DialogRoot>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
        </DialogHeader>
        <DialogBody>This action cannot be undone.</DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </DialogActionTrigger>
          <Button colorPalette="red">Delete</Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  ),
};

export const WithoutBackdrop = {
  render: () => (
    <DialogRoot>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent backdrop={false}>
        <DialogHeader>
          <DialogTitle>No backdrop</DialogTitle>
        </DialogHeader>
        <DialogBody>The page behind stays interactive.</DialogBody>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  ),
};
