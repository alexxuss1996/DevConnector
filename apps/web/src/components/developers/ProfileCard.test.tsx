// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { PublicProfileSummary } from "@dev-conn/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ProfileCard } from "@/components/developers/ProfileCard";

const summary: PublicProfileSummary = {
  _id: "6712abcd1234abcd1234abcd",
  userId: { _id: "6712abcd1234abcd1234abce", name: "Alex" },
  status: "Developer",
  skills: ["React"],
};

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

describe("ProfileCard", () => {
  it("opens detail with user id on click", async () => {
    const onOpen = vi.fn();
    const { container, root } = await render(<ProfileCard profile={summary} onOpen={onOpen} />);

    expect(container.textContent).toContain("Developer");
    expect(container.textContent).toContain("React");

    const open = container.querySelector('[data-testid="profile-open"]') as HTMLElement | null;
    expect(open).not.toBeNull();
    await act(async () => {
      open?.click();
    });

    expect(onOpen).toHaveBeenCalledWith("6712abcd1234abcd1234abce");

    await act(async () => root.unmount());
    container.remove();
  });
});
