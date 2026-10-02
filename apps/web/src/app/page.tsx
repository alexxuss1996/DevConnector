"use client";

import Link from "next/link";
import { Box, VStack, Heading, Text, Button, Stack } from "@chakra-ui/react";

export default function Home() {
  return (
    <main>
      <Box maxWidth="container.lg" mx="auto" py={8} px={4}>
        <VStack gap={6} align="center" textAlign="center">
          <Heading size="2xl">Welcome to DevConnector</Heading>
          <Text fontSize="lg">The social network for developers</Text>
          <Link href="/login?next=/posts">
            <Button colorScheme="blue" size="lg">
              Get started
              <span className="ml-2">→</span>
            </Button>
          </Link>
          <Stack direction={{ base: "column", lg: "row" }} gap={6} mt={8} w="full">
            <Box flex={1} bg="white" p={4} rounded={2} boxShadow="sm">
              <Heading size="md">Share your work</Heading>
              <Text>Post updates, ask questions, and engage with the community.</Text>
            </Box>
            <Box flex={1} bg="white" p={4} rounded={2} boxShadow="sm">
              <Heading size="md">Build your profile</Heading>
              <Text>Showcase your skills, experience, and education.</Text>
            </Box>
            <Box flex={1} bg="white" p={4} rounded={2} boxShadow="sm">
              <Heading size="md">Connect with developers</Heading>
              <Text>Find and connect with like-minded professionals.</Text>
            </Box>
          </Stack>
        </VStack>
      </Box>
    </main>
  );
}