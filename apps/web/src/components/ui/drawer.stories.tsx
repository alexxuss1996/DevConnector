import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import {
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta: Meta = { title: "UI/Drawer", tags: ["autodocs"] };

export default meta;

export const Default = {
  render: () => (
    <DrawerRoot>
      <DrawerTrigger asChild>
        <Button>Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>Drawer body content goes here.</DrawerBody>
        <DrawerFooter>
          <Button>Save</Button>
        </DrawerFooter>
        <DrawerCloseTrigger />
      </DrawerContent>
    </DrawerRoot>
  ),
};

export const WithoutBackdrop = {
  render: () => (
    <DrawerRoot>
      <DrawerTrigger asChild>
        <Button>Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent backdrop={false}>
        <DrawerHeader>
          <DrawerTitle>No backdrop</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>The page behind stays interactive.</DrawerBody>
        <DrawerCloseTrigger />
      </DrawerContent>
    </DrawerRoot>
  ),
};
