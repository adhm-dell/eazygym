import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("Stage 9: Frontend Clean-up Acceptance Tests", () => {
  const rootDir = path.resolve(__dirname, "../../..");

  it("1. Guard Script: scripts/check-no-demo.mjs passes with exit code 0", () => {
    const scriptPath = path.join(rootDir, "scripts/check-no-demo.mjs");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const output = execSync(`node "${scriptPath}"`, {
      cwd: rootDir,
      encoding: "utf-8",
    });

    expect(output).toContain("SUCCESS: No demo or test remnants found");
  });

  it("2. Staff Login Page: Fields start empty, neutral placeholders, no quick select panels", () => {
    const staffLoginPath = path.join(
      rootDir,
      "apps/staff/src/app/(auth)/login/page.tsx"
    );
    const content = fs.readFileSync(staffLoginPath, "utf-8");

    // Must start empty
    expect(content).toContain('useState("")');
    expect(content).not.toContain("reception@powercore.gym");
    expect(content).not.toContain("123456");

    // No quick accounts or demo selectors
    expect(content).not.toContain("حسابات تجريبية");
    expect(content).not.toContain("handleQuickSelectStaff");
    expect(content).not.toContain("منى (أدمن)");
    expect(content).not.toContain("سارة (استقبال)");
    expect(content).not.toContain("عمر (كاشير البار)");
    expect(content).not.toContain("م. طارق");

    // Has support hint
    expect(content).toContain("نسيت كلمة السر؟ تواصل مع مدير الجيم");
  });

  it("3. Coach Login Page: Fields start empty, neutral placeholders, no quick select panels", () => {
    const coachLoginPath = path.join(
      rootDir,
      "apps/coach/src/app/(auth)/login/page.tsx"
    );
    const content = fs.readFileSync(coachLoginPath, "utf-8");

    // Must start empty
    expect(content).toContain('useState("")');
    expect(content).not.toContain("coach.ahmed@powercore.gym");
    expect(content).not.toContain("123456");

    // No testCoaches array or demo selector
    expect(content).not.toContain("testCoaches");
    expect(content).not.toContain("handleQuickSelect");
    expect(content).not.toContain("حسابات تجريبية سريعة");

    // Has recovery hint
    expect(content).toContain("نسيت كلمة السر؟ تواصل مع إدارة الجيم");
  });

  it("4. Member Login Page: Fields start empty, neutral placeholders, no quick select panels", () => {
    const memberLoginPath = path.join(
      rootDir,
      "apps/member/src/app/(auth)/login/page.tsx"
    );
    const content = fs.readFileSync(memberLoginPath, "utf-8");

    // Must start empty
    expect(content).toContain('useState("")');
    expect(content).not.toContain("01011122233");
    expect(content).not.toContain("123456");

    // No testMembers array or demo switch
    expect(content).not.toContain("testMembers");
    expect(content).not.toContain("handleQuickSwitch");
    expect(content).not.toContain("تجربة فورية لحسابات تجريبية");

    // Has recovery hint
    expect(content).toContain("نسيت كلمة السر؟ تواصل مع موظف الاستقبال");
  });

  it("5. Staff Layout: Hard-coded account switcher removed, real logged-in user and gym shown", () => {
    const layoutPath = path.join(
      rootDir,
      "apps/staff/src/app/(app)/layout.tsx"
    );
    const content = fs.readFileSync(layoutPath, "utf-8");

    expect(content).not.toContain("staffList = [");
    expect(content).not.toContain("admin@powercore.gym");
    expect(content).not.toContain("تبديل الحساب الحالي");
    expect(content).not.toContain("فرع المعادي الرئيسي");
  });

  it("6. Scan and POS: Test simulation chips and default demo member selection removed", () => {
    const scanPath = path.join(rootDir, "apps/staff/src/app/(app)/page.tsx");
    const scanContent = fs.readFileSync(scanPath, "utf-8");

    expect(scanContent).not.toContain("testCodes = [");
    expect(scanContent).not.toContain("showTestChips");
    expect(scanContent).not.toContain("18 حالة فحص معتمدة");
    expect(scanContent).not.toContain("برايفت مع الكابتن أحمد");

    const posPath = path.join(rootDir, "apps/staff/src/app/(app)/pos/page.tsx");
    const posContent = fs.readFileSync(posPath, "utf-8");

    expect(posContent).not.toContain("runPreset1");
    expect(posContent).not.toContain("حالات الاختبار");
    expect(posContent).not.toContain("Default select member 1001 for demonstration");
  });

  it("7. Package Dependencies: @gym/mock-data removed from apps/staff, apps/coach, apps/member", () => {
    const staffPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/staff/package.json"), "utf-8")
    );
    const coachPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/coach/package.json"), "utf-8")
    );
    const memberPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "apps/member/package.json"), "utf-8")
    );

    expect(staffPkg.dependencies["@gym/mock-data"]).toBeUndefined();
    expect(coachPkg.dependencies["@gym/mock-data"]).toBeUndefined();
    expect(memberPkg.dependencies["@gym/mock-data"]).toBeUndefined();
  });
});

