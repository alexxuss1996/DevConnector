"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

/**
 * Error boundary for the root segment. Next 16 passes `retry` (stable in
 * v16.3.0), which re-fetches and re-renders the segment; the older `reset`
 * only clears the error state and is deliberately unused.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // No reporting service is wired up, so the console is the only sink. Drop
    // it and these failures are invisible.
    console.error(error);
  }, [error]);

  // An API failure carries the correlation id the backend logged; anything
  // else that crossed the server boundary carries a Next digest. Either is the
  // one string that ties a user's report back to a log line.
  //
  // Duck-typed on `requestId` rather than `instanceof ApiError`: an `ApiError`
  // constructed in a Server Component does not arrive here as an ApiError at
  // all. Next rebuilds it client-side via `resolveErrorProd()` as a bare
  // `Error` carrying only `message` and `digest`, so class identity and any
  // `name` we set are gone in a production build. `requestId` is read the same
  // way whether it survives or not, and a plain Error has no such property, so
  // the fallback is digest either way.
  const apiError = error as Partial<ApiError>;
  const reference = apiError.requestId ?? error.digest;

  return (
    <div role="alert">
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      {reference && (
        <p>
          Reference: <code>{reference}</code>
        </p>
      )}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
