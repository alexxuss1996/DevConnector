"use client";

import Image from "next/image";
import NextLink from "next/link";
import { Box, Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";
import { FiArrowRight, FiCode, FiUser, FiUsers } from "react-icons/fi";

import { PageShell } from "@/components/shell/PageShell";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/auth-redirect";

const capabilities = [
  {
    icon: FiCode,
    title: "Share your work",
    text: "Post an update, ask a question, and reply in the comments.",
  },
  {
    icon: FiUser,
    title: "Build your profile",
    text: "Record your status, skills, experience, and education once, then reuse it anywhere.",
  },
  {
    icon: FiUsers,
    title: "Find your people",
    text: "Browse the directory and open any profile to see what someone works with.",
  },
];

export default function Home() {
  return (
    <PageShell>
      {/* Asymmetric split: copy left, portrait crop of the photo right. The old
          full-bleed scrim washed the photo out and read as a stock banner. */}
      <Grid
        as="section"
        templateColumns={{ base: "1fr", md: "1.05fr 0.95fr" }}
        gap={{ base: 10, md: 12 }}
        alignItems="center"
      >
        <Stack gap={5} maxW="34rem">
          <Heading
            as="h1"
            size={{ base: "2xl", md: "3xl" }}
            lineHeight="1.05"
            letterSpacing="-0.02em"
          >
            Welcome to DevConnector
            <Box as="span" className="dc-caret" aria-hidden />
          </Heading>

          <Text fontSize={{ base: "md", md: "lg" }} color="muted" maxW="46ch">
            The social network for developers. Share what you build, keep your profile
            current, and find people working on the same stack.
          </Text>

          <Flex gap={3} wrap="wrap">
            <Button colorPalette="brand" size="lg" asChild>
              <NextLink href="/register">
                Create account <FiArrowRight />
              </NextLink>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <NextLink href={loginHref("/posts")}>Log in</NextLink>
            </Button>
          </Flex>
        </Stack>

        <Box
          position="relative"
          overflow="hidden"
          borderRadius="6px"
          borderWidth="1px"
          borderColor="line"
          aspectRatio={{ base: "4 / 3", md: "5 / 6" }}
        >
          <Image
            src="/showcase.jpg"
            alt="Developer typing code on laptop with an editor open"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 45vw"
            style={{
              objectFit: "cover",
              filter: "grayscale(1) contrast(1.08) brightness(0.78)",
            }}
          />
          <Box
            aria-hidden
            position="absolute"
            inset={0}
            bg="linear-gradient(200deg, rgba(255,166,87,0.10), rgba(11,14,17,0.72) 62%)"
          />
        </Box>
      </Grid>

      {/* A definition list, not a card row: three identical bordered boxes is
          the single most recognisable generated-page tell there is. */}
      <Stack as="section" aria-labelledby="capabilities" gap={0} mt={{ base: 16, md: 24 }}>
        <Heading as="h2" id="capabilities" size="lg" letterSpacing="-0.02em" mb={6}>
          What you get
        </Heading>

        <Box borderTopWidth="1px" borderColor="line">
          {capabilities.map((item) => (
            <Flex
              key={item.title}
              as="article"
              direction={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 8 }}
              py={5}
              borderBottomWidth="1px"
              borderColor="line"
            >
              <Flex align="center" gap={3} md={{ width: "180px", flexShrink: 0 }}>
                <Box as="span" color="brand.fg" aria-hidden display="flex">
                  <item.icon />
                </Box>
                <Heading as="h3" size="md">
                  {item.title}
                </Heading>
              </Flex>
              <Text color="muted" maxW="58ch">
                {item.text}
              </Text>
            </Flex>
          ))}
        </Box>
      </Stack>

      {/* Full-width band rather than a third copy of the split above. */}
      <Box
        as="section"
        mt={{ base: 16, md: 24 }}
        bg="panel"
        borderWidth="1px"
        borderColor="line"
        borderRadius="6px"
        px={{ base: 6, md: 10 }}
        py={{ base: 8, md: 12 }}
        textAlign="center"
      >
        <Heading as="h2" size="xl" letterSpacing="-0.02em">
          Open an account and post your first update
        </Heading>
        <Text mt={3} color="muted" mx="auto" maxW="48ch">
          Setting up takes two minutes. Your profile needs three fields and you can
          fill in the rest whenever you want.
        </Text>
        <Button mt={6} colorPalette="brand" size="lg" asChild>
          <NextLink href="/register">Create account</NextLink>
        </Button>
      </Box>
    </PageShell>
  );
}