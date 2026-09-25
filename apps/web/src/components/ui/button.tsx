import { Button as ChakraButton } from "@chakra-ui/react";
import * as React from "react";

export type ButtonProps = React.ComponentProps<typeof ChakraButton>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    return <ChakraButton ref={ref} {...props} />;
  },
);
