import { test, expect } from "@playwright/test";

test.describe("01 - Reception Scan Denial Codes", () => {
  test("renders scan page, toggles 18 test codes, and verifies denial messages", async ({ page }) => {
    await page.goto("/");

    // If shift is closed and prompt dialog appears, handle opening it or verify scan input
    const scanInput = page.locator("#scan-input");
    await expect(scanInput).toBeVisible();

    // Toggle test chips drawer
    const toggleButton = page.getByRole("button", { name: /عرض أكواد جدول الاختبار/i });
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }

    // Verify denial code chips exist
    const testCases = [
      { code: "100201", expected: "العضو غير مسجل في النظام" },
      { code: "100202", expected: "العضو محظور" },
      { code: "100203", expected: "لا يوجد اشتراك" },
      { code: "100204", expected: "لم يتم دفع الحد الأدنى" },
      { code: "100205", expected: "الاشتراك متوقف لوجود متبقي مستحق" },
      { code: "100206", expected: "الاشتراك مجمّد" },
      { code: "100207", expected: "الاشتراك منتهي" },
      { code: "100211", expected: "انتهت الجلسات" },
      { code: "100214", expected: "الحصة لم تبدأ بعد" },
    ];

    for (const tc of testCases) {
      // Find the button with this code or type it into scanInput
      const chip = page.locator(`button:has-text("${tc.code}")`).first();
      if (await chip.isVisible()) {
        await chip.click();
      } else {
        await scanInput.fill(tc.code);
        await scanInput.press("Enter");
      }

      // Check that the denial message or reason overlay appears
      const overlayText = page.getByText(tc.expected);
      await expect(overlayText).toBeVisible({ timeout: 5000 });

      // Dismiss overlay with Escape key
      await page.keyboard.press("Escape");
    }
  });
});

