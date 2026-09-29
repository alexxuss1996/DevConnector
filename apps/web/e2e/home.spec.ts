import { expect, test } from "@playwright/test";

// The title alone comes from the root layout's static `metadata`, so it holds
// even if the page body is empty or throws below the layout. Assert the body.
test("renders the current home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("DevConnector");
  await expect(
    page.getByRole("heading", { name: "Welcome to DevConnector", level: 1 }),
  ).toBeVisible();
});
