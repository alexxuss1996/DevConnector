// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("nuqs", () => ({
  useQueryState: () => ["/posts", vi.fn()],
}));

vi.mock("@/lib/queries", () => ({
  useRegisterMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import RegisterPage from "@/app/(auth)/register/page";

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

describe("RegisterPage", () => {
  it("submits name+email+password via useRegisterMutation and redirects to create-profile", async () => {
    const { container, root } = await render(<RegisterPage />);

    const name = container.querySelector('input[name="name"]') as HTMLInputElement | null;
    const email = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const password = container.querySelector('input[name="password"]') as HTMLInputElement | null;
    expect(name).not.toBeNull();
    expect(email).not.toBeNull();
    expect(password).not.toBeNull();

    await act(async () => {
      fill(name, "Jane Dev");
      fill(email, "you@example.com");
      fill(password, "password123");
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submit).not.toBeNull();
    await act(async () => {
      submit?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      name: "Jane Dev",
      email: "you@example.com",
      password: "password123",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/create-profile?next=%2Fposts");

    await act(async () => root.unmount());
    container.remove();
  });

  it("links to login preserving next", async () => {
    const { container, root } = await render(<RegisterPage />);
    const links = Array.from(container.querySelectorAll("a"));
    const loginLink = links.find((a) => a.getAttribute("href")?.includes("/login"));
    expect(loginLink).not.toBeUndefined();

    await act(async () => root.unmount());
    container.remove();
  });
});
