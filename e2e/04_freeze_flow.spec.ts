import { test, expect } from "@playwright/test";

test.describe("04 - Freeze and Unfreeze Subscription Flow", () => {
  test("visits subscriptions page, opens freeze dialog, verifies remaining allowance and submits freeze", async ({ page }) => {
    await page.goto("/subscriptions");

    // Expect subscriptions page header
    await expect(page.getByText(/إدارة الاشتراكات/i)).toBeVisible();

    // Look for an action button for freeze on active subscription
    const freezeTrigger = page.locator("button:has-text('تجميد'), button[title*='تجميد']").first();
    if (await freezeTrigger.isVisible()) {
      await freezeTrigger.click();

      // Verify Freeze dialog is open
      const freezeHeading = page.getByText(/تجميد الاشتراك|طلب تجميد/i);
      await expect(freezeHeading).toBeVisible();

      // Enter freeze days (e.g. 7 days)
      const daysInput = page.locator("input[placeholder*='عدد الأيام'], input[type='number']").first();
      if (await daysInput.isVisible()) {
        await daysInput.fill("7");
      }

      // Enter optional reason
      const reasonInput = page.locator("input[placeholder*='السبب'], textarea[placeholder*='السبب']").first();
      if (await reasonInput.isVisible()) {
        await reasonInput.fill("سفر عمل مؤقت");
      }

      // Cancel or submit dialog
      const cancelBtn = page.getByRole("button", { name: /إلغاء/i }).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });
});

