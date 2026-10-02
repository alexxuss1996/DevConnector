import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";

/** Login URL preserving where the user was headed. */
export function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** True when the session is dead rather than the request being wrong. */
export function isUnauthorizedError(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

/**
 * Returns a handler that sends expired sessions to login (preserving `next`)
 * and reports whether it redirected. Call it first in mutation catch paths;
 * anything it declines still needs the usual error toast.
 */
export function useUnauthorizedRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (err: unknown) => {
    if (!isUnauthorizedError(err)) return false;
    const search = searchParams.toString();
    router.replace(loginHref(pathname + (search ? `?${search}` : "")));
    return true;
  };
}
