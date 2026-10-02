"use client";

import NextLink from "next/link";
import { Box, Flex, Link as ChakraLink, Text } from "@chakra-ui/react";

import { loginHref } from "@/lib/auth-redirect";

export function SiteFooter() {
  return (
    <Box as="footer" borderTopWidth="1px" borderColor="line" bg="panel">
      <Box maxW="1080px" mx="auto" px={{ base: 4, md: 6 }} py={5}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
          <Text fontSize="sm" color="muted">
            DevConnector, an internal developer community
          </Text>
          <Flex gap={5} fontSize="sm">
            <FooterLink href={loginHref("/posts")}>Log in</FooterLink>
            <FooterLink href="/register">Create account</FooterLink>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <ChakraLink asChild color="fg" textDecoration="none" _hover={{ color: "brand.fg" }}>
      <NextLink href={href}>{children}</NextLink>
    </ChakraLink>
  );
}