// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  useCreatePostMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import { PostComposer } from "@/components/posts/PostComposer";

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

function fillTextarea(el: HTMLTextAreaElement | null, value: string) {
  if (!el) throw new Error("textarea missing");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  mocks.mutateAsync.mockClear();
  mocks.mutateAsync.mockResolvedValue({ _id: "6712abcd1234abcd1234abcd" });
});

describe("PostComposer", () => {
  it("submits text via useCreatePostMutation and clears", async () => {
    const onCreated = vi.fn();
    const { container, root } = await render(<PostComposer onCreated={onCreated} />);

    const textarea = container.querySelector("textarea");
    await act(async () => {
      fillTextarea(textarea, "Hello world");
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submit).not.toBeNull();
    await act(async () => {
      submit?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledWith({ text: "Hello world" });
    expect(onCreated).toHaveBeenCalledOnce();
    expect((container.querySelector("textarea") as HTMLTextAreaElement)?.value).toBe("");

    await act(async () => root.unmount());
    container.remove();
  });
});
