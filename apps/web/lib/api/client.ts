const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
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
  const data = text ? (JSON.parse(text) as T) : (undefined as T);

  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: string }).message)
        : `Request failed: ${res.status}`,
    );
  }

  return data;
}

export { API_URL };
