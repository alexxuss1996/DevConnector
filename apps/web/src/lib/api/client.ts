const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Structured error for non-2xx API responses. Carries the backend `code`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  code?: string;
  message?: string;
}

/** Base HTTP client for the DevConnector API (cookie session auth). */
export class ApiClient {
  constructor(private readonly baseUrl: string = API_URL) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      ...init,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    const data = text ? (JSON.parse(text) as T & ErrorBody) : (undefined as T);

    if (!res.ok) {
      const body = (data ?? {}) as ErrorBody;
      throw new ApiError(
        res.status,
        body.code ?? "REQUEST_FAILED",
        body.message ?? `Request failed: ${res.status}`,
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

  protected delete<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}

/** Shared instance used by the resource clients. */
export const apiClient = new ApiClient();

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Builds a `?page=&limit=` suffix, omitting unset params. */
export function toQuery(params: PaginationParams): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Backwards-compatible fetch helper (delegates to the shared ApiClient).
 * Prefer `ApiClient`/`apiClient` for new code.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiClient.request<T>(path, init);
}

export { API_URL };
