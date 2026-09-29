import { SkeletonText } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the root segment. `role="status"` is what announces
 * the wait to a screen reader — a bare skeleton is decoration.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <SkeletonText noOfLines={3} />
    </div>
  );
}
