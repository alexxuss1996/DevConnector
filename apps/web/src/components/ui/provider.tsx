"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

import { ColorModeProvider, type ColorModeProviderProps } from "@/components/ui/color-mode";
import { system } from "@/theme";

export function Provider(props: ColorModeProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider {...props}>
          <NuqsAdapter>{props.children}</NuqsAdapter>
        </ColorModeProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
