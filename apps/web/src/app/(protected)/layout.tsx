"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Text } from "@chakra-ui/react";

import { PageShell } from "@/components/shell/PageShell";
import { StatusBar } from "@/components/shell/StatusBar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useMyProfile } from "@/lib/queries";

function GuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 401/404 from this endpoint are terminal (signed out / no profile yet),
  // so retries would only stall the redirect below by seconds.
  const { data, error, isLoading } = useMyProfile({ retry: false });

  useEffect(() => {
    if (!isLoading && error instanceof ApiError && error.status === 401) {
      const search = searchParams.toString();
      router.replace(
        `/login?next=${encodeURIComponent(pathname + (search ? `?${search}` : ""))}`,
      );
    }
    // Authenticated but profileless (fresh signup): /profiles/me 404s because
    // there is nothing to return yet. Send them to onboarding instead of an
    // error page; the EmptyState below is only for real failures.
    if (!isLoading && error instanceof ApiError && error.status === 404) {
      const search = searchParams.toString();
      router.replace(
        `/create-profile?next=${encodeURIComponent(pathname + (search ? `?${search}` : ""))}`,
      );
    }
  }, [isLoading, error, router, pathname, searchParams]);

  // The shell renders in every state, redirecting or not, so the header and
  // footer do not pop in and out as the session check resolves.
  const shell = (body: React.ReactNode) => (
    <PageShell
      headerActions={
        data ? (
          <Text className="dc-mono" fontSize="xs" color="muted" truncate>
            {data.profile.userId.name ?? "Developer"}
          </Text>
        ) : undefined
      }
      belowHeader={<StatusBar detail={data?.profile.status} />}
    >
      {body}
    </PageShell>
  );

  if (isLoading) return shell(<Skeleton height="32px" />);
  if (error instanceof ApiError && error.status === 401) return shell(null);
  if (error instanceof ApiError && error.status === 404) return shell(null);
  if (error) {
    return shell(
      <EmptyState
        title="Something went wrong"
        description="Could not check your session. Try again."
      />,
    );
  }
  if (!data) return shell(null);
  return shell(children);
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // useSearchParams needs a Suspense boundary or production build fails
  // (see use-search-params docs: missing-suspense-with-csr-bailout).
  return (
    <Suspense fallback={<Skeleton height="32px" />}>
      <GuardInner>{children}</GuardInner>
    </Suspense>
  );
}