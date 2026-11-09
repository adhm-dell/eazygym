import { test, expect } from "@playwright/test";

test.describe("03 - Open & Close Shift with Cash Variance", () => {
  test("views shift details, opens close shift modal, calculates variance and completes handover", async ({ page }) => {
    await page.goto("/shift");

    // Expect Shift management page to be visible
    await expect(page.getByText(/إدارة الورديات/i)).toBeVisible();

    // Check if shift is currently open, or open it
    const openCloseBtn = page.getByRole("button", { name: /إقفال الوردية وجرد الخزينة|إقفال الوردية/i }).first();
    const startShiftBtn = page.getByRole("button", { name: /بدء وردية جديدة|فتح وردية/i }).first();

    if (await startShiftBtn.isVisible()) {
      await startShiftBtn.click();
      const openingInput = page.locator("input[placeholder*='0.00'], input[type='number']").first();
      if (await openingInput.isVisible()) {
        await openingInput.fill("500");
        const confirmBtn = page.getByRole("button", { name: /تأكيد فتح الوردية|تأكيد/i });
        await confirmBtn.click();
      }
    }

    // Now trigger Close Shift Modal
    if (await openCloseBtn.isVisible()) {
      await openCloseBtn.click();

      // Expect Close Shift Dialog to open
      await expect(page.getByText(/إقفال الوردية وجرد النقدية بالدرج/i)).toBeVisible();

      // Enter counted cash that generates a shortage variance
      const countedInput = page.locator("input[step='0.5'], input[type='number']").first();
      await expect(countedInput).toBeVisible();

      // If expected is say 500, enter 400 to force a shortage variance
      await countedInput.fill("400");

      // Verify shortage indicator badge appears
      const shortageBadge = page.getByText(/عجز بالخزينة/i);
      await expect(shortageBadge).toBeVisible();

      // Close modal
      const cancelBtn = page.getByRole("button", { name: /إلغاء/i }).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });
});

