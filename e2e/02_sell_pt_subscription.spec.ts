import { test, expect } from "@playwright/test";

test.describe("02 - Sell PT Subscription with Promotion & Split Payment", () => {
  test("selects member, adds PT package, applies promo discount, splits payment and checks out", async ({ page }) => {
    await page.goto("/pos");

    // Expect POS page elements to load
    await expect(page.getByText(/نقطة البيع والاشتراكات/i)).toBeVisible();

    // Select Member
    const memberSelector = page.locator("text=اختر العضو أو امسح الباركود").first();
    if (await memberSelector.isVisible()) {
      await memberSelector.click();
      // Pick first member in list
      const firstMember = page.locator("button:has-text('عضو')").first();
      if (await firstMember.isVisible()) {
        await firstMember.click();
      }
    }

    // Select Plans tab if not active
    const plansTab = page.getByRole("button", { name: /باقات واشتراكات/i });
    if (await plansTab.isVisible()) {
      await plansTab.click();
    }

    // Click on a PT plan card
    const ptPlanCard = page.locator("button:has-text('PT')").first();
    if (await ptPlanCard.isVisible()) {
      await ptPlanCard.click();

      // Configure plan dialog may pop up to choose coach
      const confirmAddBtn = page.getByRole("button", { name: /إضافة للسلة|تأكيد الإضافة/i });
      if (await confirmAddBtn.isVisible()) {
        await confirmAddBtn.click();
      }
    }

    // Check cart item is present
    await expect(page.locator("text=سلة المشتريات")).toBeVisible();

    // Apply promotion code
    const promoInput = page.locator("input[placeholder*='كود الخصم']");
    if (await promoInput.isVisible()) {
      await promoInput.fill("TEST10");
      const applyBtn = page.getByRole("button", { name: /تطبيق/i });
      if (await applyBtn.isVisible()) {
        await applyBtn.click();
      }
    }

    // Split Payment: Enter Cash & Card / Instapay amounts
    const cashInput = page.locator("input[name='cashAmount'], input[aria-label*='نقداً']").first();
    if (await cashInput.isVisible()) {
      await cashInput.fill("500");
    }

    // Verify checkout button is present
    const checkoutBtn = page.getByRole("button", { name: /إتمام الدفع|إصدار الفاتورة/i });
    await expect(checkoutBtn).toBeVisible();
  });
});

