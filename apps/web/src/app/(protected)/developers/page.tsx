"use client";

import { Suspense } from "react";
import { useQueryState } from "nuqs";
import { Box, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "@/components/developers/ProfileCard";
import { ProfileDetailDialog } from "@/components/developers/ProfileDetailDialog";
import { useProfiles } from "@/lib/queries";

const LIMIT = 12;

function DevelopersContent() {
  const [page, setPage] = useQueryState("page", { defaultValue: 1, parse: Number });
  const [userId, setUserId] = useQueryState("userId", { defaultValue: "" });
  const { data, isLoading, error } = useProfiles({ page, limit: LIMIT });

  return (
    <Box maxW="900px" mx="auto" w="full">
      <Heading as="h1" size="xl" letterSpacing="-0.02em">
        Developers
      </Heading>
      <Text color="muted" mt={1} mb={8}>
        {data ? `${data.total} on the network` : "Everyone on the network."}
      </Text>

      {isLoading && <Skeleton height="20px" />}
      {error && (
        <EmptyState
          title="Something went wrong"
          description="Could not load developers. Try again."
        />
      )}
      {data && data.total === 0 && (
        <EmptyState title="No developers yet" description="Check back later." />
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        {data?.profiles.map((profile) => (
          <ProfileCard key={profile._id} profile={profile} onOpen={(id) => void setUserId(id)} />
        ))}
      </SimpleGrid>

      {data && data.total > 0 && (
        <Flex data-testid="pagination" justify="center" mt={8}>
          <PaginationRoot
            count={data.total}
            pageSize={LIMIT}
            page={page}
            onPageChange={(e) => void setPage(e.page)}
          >
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </PaginationRoot>
        </Flex>
      )}

      {userId && <ProfileDetailDialog userId={userId} onClose={() => void setUserId("")} />}
    </Box>
  );
}

export default function DevelopersPage() {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <DevelopersContent />
    </Suspense>
  );
}