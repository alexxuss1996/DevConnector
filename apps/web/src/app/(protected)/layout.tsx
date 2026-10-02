"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api/client";
import { useMyProfile } from "@/lib/queries";

function GuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, error, isLoading } = useMyProfile();

  useEffect(() => {
    if (!isLoading && error instanceof ApiError && error.status === 401) {
      const search = searchParams.toString();
      router.replace(
        `/login?next=${encodeURIComponent(pathname + (search ? `?${search}` : ""))}`,
      );
    }
  }, [isLoading, error, router, pathname, searchParams]);

  if (isLoading) return <Skeleton height="20px" />;
  if (error instanceof ApiError && error.status === 401) return null;
  if (error) return <EmptyState title="Something went wrong" description="Could not check your session. Try again." />;
  if (!data) return null;
  return <>{children}</>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // useSearchParams needs a Suspense boundary or production build fails
  // (see use-search-params docs: missing-suspense-with-csr-bailout).
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <GuardInner>{children}</GuardInner>
    </Suspense>
  );
}
