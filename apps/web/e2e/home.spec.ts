import { expect, test } from "@playwright/test";

test("renders the current home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("DevConnector");
  await expect(page.getByText("Get started by editing")).toBeVisible();
  await expect(page.getByRole("link", { name: "Deploy now" })).toBeVisible();
});
