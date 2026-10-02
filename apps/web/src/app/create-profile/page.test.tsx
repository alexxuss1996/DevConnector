// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  mutateAsync: vi.fn(),
  setNext: vi.fn(),
  myProfile: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("nuqs", () => ({
  useQueryState: () => ["/posts", mocks.setNext],
}));

vi.mock("@/lib/queries", () => ({
  useMyProfile: () => mocks.myProfile,
  useCreateProfileMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import CreateProfilePage from "@/app/create-profile/page";

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

function fill(input: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!input) throw new Error("input missing");
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  mocks.replace.mockClear();
  mocks.mutateAsync.mockClear();
  mocks.mutateAsync.mockResolvedValue({ profile: { _id: "p1" } });
  mocks.myProfile = {
    isLoading: false,
    error: new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found"),
  };
});

describe("CreateProfilePage", () => {
  it("submits the profile and redirects to next", async () => {
    const { container, root } = await render(<CreateProfilePage />);

    const status = container.querySelector('input[name="status"]') as HTMLInputElement | null;
    const skills = container.querySelector('input[name="skills"]') as HTMLInputElement | null;
    expect(status).not.toBeNull();
    expect(skills).not.toBeNull();

    await act(async () => {
      fill(status, "Developer");
      fill(skills, "JavaScript, React");
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submit).not.toBeNull();
    await act(async () => {
      submit?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      status: "Developer",
      skills: ["JavaScript", "React"],
      company: undefined,
      location: undefined,
      bio: undefined,
    });
    expect(mocks.replace).toHaveBeenCalledWith("/posts");

    await act(async () => root.unmount());
    container.remove();
  });

  it("redirects to posts when the profile already exists", async () => {
    mocks.myProfile = {
      isLoading: false,
      data: { profile: { _id: "p1" } },
    };

    const { container, root } = await render(<CreateProfilePage />);

    expect(mocks.replace).toHaveBeenCalledWith("/posts");
    expect(container.querySelector('input[name="status"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
