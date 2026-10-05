"use client";

import { Box, Flex } from "@chakra-ui/react";

import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";

export interface PageShellProps {
  children: React.ReactNode;
  /** Replaces the default signed-out header actions (signed-in routes). */
  headerActions?: React.ReactNode;
  /** A full-width row between the header and the content, e.g. the StatusBar. */
  belowHeader?: React.ReactNode;
  maxW?: string;
}

/**
 * The chrome every route shares: header, optional row beneath it, content,
 * footer. The column is `minH="100dvh"` with a flexing main so the footer sits
 * at the bottom of short pages instead of floating halfway up, and `dvh`
 * rather than `vh` so mobile browser chrome cannot push it off-screen.
 */
export function PageShell({
  children,
  headerActions,
  belowHeader,
  maxW = "1200px",
}: PageShellProps) {
  return (
    <Flex direction="column" minH="100dvh" bg="canvas">
      <Box
        position="sticky"
        top={0}
        zIndex={10}
        bg="panel"
        borderBottomWidth="1px"
        borderColor="line"
      >
        <SiteHeader actions={headerActions} />
        {belowHeader}
      </Box>

      <Box
        as="main"
        flex="1"
        w="full"
        maxW={maxW}
        mx="auto"
        px={{ base: 4, md: 6 }}
        pt={{ base: 8, md: 10 }}
        pb={{ base: 12, md: 16 }}
      >
        {children}
      </Box>

      <SiteFooter />
    </Flex>
  );
}
