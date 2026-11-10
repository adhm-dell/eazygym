import { test, expect } from "@playwright/test";

test.describe("Stage 9: Clean Login Pages (No Demo / Test Remnants)", () => {
  test("Staff login page loads with empty fields and no quick-login buttons", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue("");

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveValue("");

    // Quick select panels or demo buttons must NOT exist
    await expect(page.getByText("حسابات تجريبية سريعة")).not.toBeVisible();
    await expect(page.getByText("سارة (استقبال)")).not.toBeVisible();
    await expect(page.getByText("عمر (كاشير البار)")).not.toBeVisible();
    await expect(page.getByText("منى (أدمن)")).not.toBeVisible();
  });
});
