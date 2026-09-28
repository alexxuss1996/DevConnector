import { expect, test } from "@playwright/test";

test("renders the current home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("DevConnector");
});
