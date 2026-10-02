"use client";

import { Suspense } from "react";
import { useQueryState } from "nuqs";
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
  const { data, isLoading } = useProfiles({ page, limit: LIMIT });

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 640 }}>
      <h1>Developers</h1>
      {isLoading && <Skeleton height="20px" />}
      {data && data.total === 0 && (
        <EmptyState title="No developers yet" description="Check back later." />
      )}
      {data?.profiles.map((profile) => (
        <ProfileCard key={profile._id} profile={profile} onOpen={(id) => void setUserId(id)} />
      ))}
      {data && data.total > 0 && (
        <div data-testid="pagination">
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
        </div>
      )}
      {userId && <ProfileDetailDialog userId={userId} onClose={() => void setUserId("")} />}
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <DevelopersContent />
    </Suspense>
  );
}
