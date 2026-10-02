"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, Link as ChakraLink, Text } from "@chakra-ui/react";

const ROUTES = [
  { href: "/posts", label: "/posts" },
  { href: "/developers", label: "/developers" },
] as const;

/**
 * Route tabs plus a session readout, on its own row under the header.
 *
 * It lives here rather than inside the header row so it never has to wrap: the
 * header stays a single 56px line at every width, and these tabs stay visible
 * on mobile where a combined row would overflow.
 */
export function StatusBar({ detail }: { detail?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Box borderTopWidth="1px" borderColor="line">
      <Box maxW="1080px" mx="auto" px={{ base: 4, md: 6 }}>
        <Flex minH={8} align="center" gap={{ base: 4, md: 6 }} className="dc-mono" fontSize="xs">
          <Flex as="nav" gap={{ base: 4, md: 5 }}>
            {ROUTES.map((route) => {
              const active = pathname === route.href;
              return (
                <ChakraLink
                  key={route.href}
                  asChild
                  color={active ? "fg" : "muted"}
                  textDecoration="none"
                  aria-current={active ? "page" : undefined}
                  borderBottomWidth="2px"
                  borderColor={active ? "brand.solid" : "transparent"}
                  lineHeight="20px"
                  _hover={{ color: "fg", textDecoration: "none" }}
                >
                  <NextLink href={route.href}>{route.label}</NextLink>
                </ChakraLink>
              );
            })}
          </Flex>
          {detail && (
            <Text ml="auto" color="muted" display={{ base: "none", sm: "block" }} truncate>
              {detail}
            </Text>
          )}
        </Flex>
      </Box>
    </Box>
  );
}