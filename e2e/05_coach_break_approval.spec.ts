import { test, expect } from "@playwright/test";

test.describe("05 - Coach Break Request & Admin Approval Flow", () => {
  test("navigates to coach ops breaks board and verifies pending requests / active breaks", async ({ page }) => {
    await page.goto("/coach-ops");

    // Expect coach operations page
    await expect(page.getByText(/إدارة عمليات المدربين/i)).toBeVisible();

    // Click on Breaks tab ("لوحة الاستراحات الحية")
    const breaksTab = page.getByRole("button", { name: /لوحة الاستراحات الحية/i });
    await expect(breaksTab).toBeVisible();
    await breaksTab.click();

    // Verify Breaks board loaded
    await expect(page.getByText(/الاستراحة النشطة حالياً|طلبات الاستراحة المعلقة/i)).toBeVisible();

    // Check for Start Break or Approve button if available
    const startBreakBtn = page.getByRole("button", { name: /بدء استراحة جديدة|طلب استراحة/i }).first();
    if (await startBreakBtn.isVisible()) {
      await startBreakBtn.click();
      const modalHeader = page.getByText(/بدء استراحة لمدرب|طلب استراحة/i);
      await expect(modalHeader).toBeVisible();

      // Cancel modal
      const cancelBtn = page.getByRole("button", { name: /إلغاء/i }).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });
});

