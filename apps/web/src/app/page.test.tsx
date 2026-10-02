// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

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

describe("Home", () => {
  it("renders the heading and subheading", async () => {
    const { container } = await render(<Home />);

    expect(container.textContent).toContain("Welcome to DevConnector");
    expect(container.textContent).toContain("The social network for developers");
  });

  it("has register and login CTAs", async () => {
    const { container } = await render(<Home />);

    const links = Array.from(container.querySelectorAll("a"));
    const registerLink = links.find((a) => a.getAttribute("href")?.includes("/register"));
    expect(registerLink).not.toBeUndefined();
    const loginLink = links.find((a) => a.getAttribute("href")?.includes("login"));
    expect(loginLink).not.toBeUndefined();
  });

  it("shows hero image with descriptive alt", async () => {
    const { container } = await render(<Home />);

    const img = container.querySelector('img[alt*="Developer typing code on laptop"]');
    expect(img).not.toBeNull();
  });

  it("has header, main and footer landmarks", async () => {
    const { container } = await render(<Home />);

    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
    expect(container.querySelector("footer")).not.toBeNull();
  });
});
