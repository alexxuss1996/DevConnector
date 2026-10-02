"use client";

import type { PublicProfileSummary } from "@dev-conn/contracts";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

export function ProfileCard({
  profile,
  onOpen,
}: {
  profile: PublicProfileSummary;
  onOpen: (userId: string) => void;
}) {
  const meta = [profile.company, profile.location].filter(Boolean).join(" · ");

  return (
    <Box
      as="article"
      data-testid="profile-card"
      bg="panel"
      borderWidth="1px"
      borderColor="line"
      borderRadius="6px"
      p={5}
      transition="border-color 120ms ease"
      _hover={{ borderColor: "brand.fg" }}
    >
      <Flex gap={4} align="start">
        <Avatar name={profile.userId.name} flexShrink={0} />

        <Box flex="1" minW={0}>
          <Button
            data-testid="profile-open"
            variant="plain"
            onClick={() => onOpen(profile.userId._id)}
            h="auto"
            p={0}
            display="block"
            w="full"
            textAlign="left"
            fontWeight="semibold"
            fontSize="md"
            color="fg"
            _hover={{ color: "brand.fg" }}
          >
            {profile.userId.name ?? "Developer"}
          </Button>

          <Text className="dc-mono" fontSize="xs" color="brand.fg" mt={1}>
            {profile.status}
          </Text>

          {meta && (
            <Text className="dc-mono" fontSize="xs" color="muted" mt={1}>
              {meta}
            </Text>
          )}

          <Flex gap={1.5} wrap="wrap" mt={3}>
            {profile.skills.map((skill) => (
              <Tag key={skill} size="sm" variant="subtle" colorPalette="brand" className="dc-mono">
                {skill}
              </Tag>
            ))}
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}