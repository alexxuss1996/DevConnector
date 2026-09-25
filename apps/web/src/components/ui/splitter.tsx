import { Splitter as ChakraSplitter } from "@chakra-ui/react"
import * as React from "react"

export interface SplitterProps extends ChakraSplitter.RootProps {
  orientation?: "horizontal" | "vertical"
}

export const Splitter = React.forwardRef<HTMLDivElement, SplitterProps>(
  function Splitter(props, ref) {
    const { orientation = "horizontal", children, ...rest } = props
    return (
      <ChakraSplitter.Root ref={ref} orientation={orientation} {...rest}>
        {children}
      </ChakraSplitter.Root>
    )
  },
)

export const SplitterPanel = React.forwardRef<
  HTMLDivElement,
  ChakraSplitter.PanelProps
>(function SplitterPanel(props, ref) {
  return <ChakraSplitter.Panel {...props} ref={ref} />
})

export const SplitterResizeTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraSplitter.ResizeTriggerProps
>(function SplitterResizeTrigger(props, ref) {
  return <ChakraSplitter.ResizeTrigger {...props} ref={ref} />
})

export const SplitterRoot: typeof ChakraSplitter.Root = ChakraSplitter.Root
export const SplitterRootProvider: typeof ChakraSplitter.RootProvider =
  ChakraSplitter.RootProvider
export const SplitterPropsProvider: typeof ChakraSplitter.PropsProvider =
  ChakraSplitter.PropsProvider
export const SplitterContext: typeof ChakraSplitter.Context =
  ChakraSplitter.Context
