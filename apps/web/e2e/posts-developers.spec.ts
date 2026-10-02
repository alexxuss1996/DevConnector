import { expect, test } from "@playwright/test";

// Needs a live API (NEXT_PUBLIC_API_URL or http://localhost:4000) with a
// seeded user e2e@example.com / password123. Skipped until that exists;
// the body documents the intended smoke flow.
test.fixme(
  "login, browse posts, comment, browse developers",
  async ({ page }) => {
    await page.goto("/login?next=/posts");

    await page.getByLabel(/email/i).fill("e2e@example.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByTestId("post-card").first()).toBeVisible();

    await page.getByTestId("post-open").first().click();
    await expect(page.getByText("Add a comment")).toBeVisible();
    await page.getByPlaceholder("Write a comment...").fill("Nice post!");
    await page.getByRole("button", { name: /comment/i }).click();
    await expect(page.getByText("Nice post!")).toBeVisible();

    await page.goto("/developers");
    await expect(page.getByTestId("profile-card").first()).toBeVisible();
  },
);
