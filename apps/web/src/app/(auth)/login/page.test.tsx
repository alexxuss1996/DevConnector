// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  mutateAsync: vi.fn(),
  setNext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("nuqs", () => ({
  useQueryState: () => ["/posts", mocks.setNext],
}));

vi.mock("@/lib/queries", () => ({
  useLoginMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import LoginPage from "@/app/(auth)/login/page";

async function render(node: React.ReactNode) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ChakraProvider value={defaultSystem}>{node}</ChakraProvider>);
  });

  return { container, root };
}

function fill(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error("input missing");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  mocks.replace.mockClear();
  mocks.mutateAsync.mockClear();
  mocks.mutateAsync.mockResolvedValue({
    user: { id: "6712abcd1234abcd1234abcd", email: "x@y.com" },
    accessToken: "a",
    refreshToken: "r",
  });
});

describe("LoginPage", () => {
  it("submits email+password via useLoginMutation and redirects to next", async () => {
    const { container, root } = await render(<LoginPage />);

    const email = container.querySelector('input[type="email"], input[name="email"]') as HTMLInputElement | null;
    const password = container.querySelector(
      'input[type="password"], input[name="password"]',
    ) as HTMLInputElement | null;
    expect(email).not.toBeNull();
    expect(password).not.toBeNull();

    await act(async () => {
      fill(email, "you@example.com");
      fill(password, "password123");
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submit).not.toBeNull();
    await act(async () => {
      submit?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      email: "you@example.com",
      password: "password123",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/posts");

    await act(async () => root.unmount());
    container.remove();
  });
});
