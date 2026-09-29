const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REFRESH_PATH = "/auth/refresh";

/**
 * `PaginationQuerySchema` in @dev-conn/contracts declares page minimum 1 and
 * limit 1-100, and `parsePagination` clamps server-side. Clamping here too stops
 * the client emitting a value the server is guaranteed to reject.
 *
 * ponytail: these bounds are duplicated from the contracts package. They are
 * duplicated because the schema does not export its numeric limits; if that ever
 * changes, a round-trip test against the real API would catch the drift.
 */
const MIN_PAGE = 1;
const MAX_PAGE = 10_000;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Structured error for non-2xx API responses. Carries the backend `code`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /**
     * The API's correlation id for this request. Surface it so a user
     * reporting a failure can quote something the server can find in its logs.
     */
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  code?: string;
  message?: string;
  requestId?: string;
}

/**
 * Parses a JSON body, or `undefined` when it isn't JSON. Without this a proxy
 * or gateway HTML error page throws a `SyntaxError` and the HTTP status — the
 * only useful part of the failure — is lost.
 */
function parseJson<T>(text: string): (T & ErrorBody) | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T & ErrorBody;
  } catch {
    return undefined;
  }
}

/**
 * A refresh already in progress, shared across every client instance so a burst
 * of concurrent 401s costs one refresh call rather than one each. The whole app
 * has separate `authApi` / `postsApi` / `profileApi` singletons, so this cannot
 * live on an instance.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function requestRefresh(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}${REFRESH_PATH}`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function refreshSession(baseUrl: string): Promise<boolean> {
  // `??=` assigns before the finally callback can run, so the reset cannot race
  // the assignment and leave a settled promise cached forever.
  refreshInFlight ??= requestRefresh(baseUrl).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Base HTTP client for the DevConnector API (cookie session auth). */
export class ApiClient {
  constructor(private readonly baseUrl: string = API_URL) {}

  /**
   * @param internal `isRefresh` marks the refresh call itself so a rejected
   *   refresh cannot trigger another one; `retried` bounds the replay to one.
   */
  async request<T>(
    path: string,
    init: RequestInit = {},
    internal: { retried?: boolean; isRefresh?: boolean } = {},
  ): Promise<T> {
    // `...init` first: spreading it after the headers silently discarded the
    // merged header object whenever a caller passed its own.
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: init.credentials ?? "include",
      headers: buildHeaders(init),
    });

    if (res.status === 401 && !internal.retried && !internal.isRefresh) {
      // The access cookie expired mid-session. Refresh once and replay, so a
      // logged-in user is not logged out by a token simply reaching its age.
      if (await refreshSession(this.baseUrl)) {
        return this.request<T>(path, init, { retried: true });
      }
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    const data = parseJson<T>(text);

    if (!res.ok) {
      const body = (data ?? {}) as ErrorBody;
      throw new ApiError(
        res.status,
        body.code ?? "REQUEST_FAILED",
        body.message ?? `Request failed: ${res.status}`,
        // Fall back to the echoed header for errors sent outside errorHandler.
        body.requestId ?? res.headers.get("x-request-id") ?? undefined,
      );
    }

    if (data === undefined && text.trim() !== "") {
      // A 2xx whose body is not JSON — a captive portal or a gateway login
      // page. Returning `undefined` typed as T surfaced as a TypeError at the
      // render site, nowhere near the actual cause.
      throw new ApiError(
        res.status,
        "INVALID_RESPONSE",
        `Expected a JSON response from ${path} but received ${
          res.headers.get("content-type") ?? "an unknown content type"
        }`,
        res.headers.get("x-request-id") ?? undefined,
      );
    }

    return data as T;
  }

  protected get<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  protected post<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  protected put<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  protected patch<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  protected delete<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }

  /** POSTs the refresh endpoint directly, bypassing the 401 handling above. */
  protected requestRefreshEndpoint<T>(): Promise<T> {
    return this.request<T>(REFRESH_PATH, { method: "POST" }, { isRefresh: true });
  }
}

/**
 * Content-Type is only meaningful with a body, and sending it on a bodyless
 * request makes a cross-origin GET non-simple, forcing a CORS preflight for
 * every read. A caller-supplied Content-Type always wins.
 */
function buildHeaders(init: RequestInit): Record<string, string> {
  const supplied = init.headers;
  const headers: Record<string, string> =
    supplied instanceof Headers
      ? Object.fromEntries(supplied.entries())
      : { ...(supplied as Record<string, string> | undefined) };

  if (init.body !== undefined && init.body !== null && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Shared instance bound to the default API URL. */
export const apiClient = new ApiClient();

/**
 * Backwards-compatible fetch helper (delegates to the shared ApiClient).
 * Prefer `ApiClient`/`apiClient` for new code.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiClient.request<T>(path, init);
}

/** Builds a `?page=&limit=` suffix, omitting unset params. */
export function toQuery(params: PaginationParams): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) {
    search.set("page", String(clamp(params.page, MIN_PAGE, MAX_PAGE)));
  }
  if (params.limit !== undefined) {
    search.set("limit", String(clamp(params.limit, MIN_LIMIT, MAX_LIMIT)));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export { API_URL };
