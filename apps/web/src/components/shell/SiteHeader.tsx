"use client";

import NextLink from "next/link";
import { Box, Flex, Link as ChakraLink, Text } from "@chakra-ui/react";

import { Button } from "@/components/ui/button";
import { ColorModeButton } from "@/components/ui/color-mode";
import { loginHref } from "@/lib/auth-redirect";

export interface SiteHeaderProps {
  /** Replaces the default signed-out actions once a session exists. */
  actions?: React.ReactNode;
}

/**
 * The header every route renders. One row, 56px, so it never eats the viewport;
 * the route tabs for signed-in pages live in the StatusBar directly beneath it
 * rather than crowding this row and forcing a second line on mobile.
 */
export function SiteHeader({ actions }: SiteHeaderProps) {
  return (
    <Box as="header">
      <Box maxW="1080px" mx="auto" px={{ base: 4, md: 6 }}>
        <Flex minH={14} align="center" justify="space-between" gap={4}>
          <ChakraLink asChild color="fg" textDecoration="none" _hover={{ textDecoration: "none" }}>
            <NextLink href="/" aria-label="DevConnector home">
              <Flex align="center" gap={2}>
                <Box aria-hidden boxSize="8px" bg="brand.fg" flexShrink={0} />
                <Text fontWeight="semibold" fontSize="sm" letterSpacing="-0.01em">
                  DevConnector
                </Text>
              </Flex>
            </NextLink>
          </ChakraLink>

          <Flex align="center" gap={{ base: 2, md: 3 }}>
            {actions ?? <SignedOutActions />}
            {/* Own chrome rather than part of `actions`, so the switch appears
                identically whether or not there is a session. */}
            <ColorModeButton size="sm" />
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}

function SignedOutActions() {
  return (
    <Flex align="center" gap={{ base: 3, md: 2 }}>
      <ChakraLink
        asChild
        fontSize="sm"
        color="muted"
        textDecoration="none"
        display={{ base: "none", sm: "inline" }}
        _hover={{ color: "fg", textDecoration: "none" }}
      >
        <NextLink href={loginHref("/posts")}>Log in</NextLink>
      </ChakraLink>
      <Button colorPalette="brand" size="sm" asChild>
        <NextLink href="/register">Create account</NextLink>
      </Button>
    </Flex>
  );
}