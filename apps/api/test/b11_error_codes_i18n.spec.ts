import { translateErrorCode, getDictionary } from "@gym/i18n";

describe("Phase 11 / B11 Acceptance: Error Code i18n Mapping", () => {
  const ALL_SPEC_ERROR_CODES = [
    // B01: Auth, Staff, Members, Audit
    "MISSING_GYM_CONTEXT",
    "UNAUTHORIZED",
    "INVALID_TOKEN",
    "FORBIDDEN",
    "VALIDATION_ERROR",
    "MEMBER_NOT_FOUND",
    "ACCOUNT_LOCKED",
    "INVALID_CREDENTIALS",
    "MEMBER_BLOCKED",
    "NOT_FOUND",
    "REASON_REQUIRED",
    "LAST_ADMIN",
    "PHONE_EXISTS",

    // B02: Catalog & Promotions
    "INVALID_PLAN",
    "INVALID_PROMOTION",
    "PROMOTION_CODE_EXISTS",
    "WRONG_CODE",
    "SERVICE_EXISTS",
    "PRODUCT_EXISTS",
    "OUT_OF_STOCK",

    // B03: Invoices, Payments, Wallet, Vouchers
    "NO_OPEN_SHIFT",
    "MEMBER_REQUIRED",
    "INVALID_ITEM",
    "PLAN_NOT_FOUND",
    "SERVICE_NOT_FOUND",
    "PRODUCT_NOT_FOUND",
    "MULTIPLE_DISCOUNTS",
    "INSUFFICIENT_WALLET_BALANCE",
    "INVOICE_VOIDED",
    "REFUND_EXCEEDS_COLLECTED",
    "ALREADY_VOIDED",
    "WALLET_CANNOT_BE_NEGATIVE",

    // B04: Subscriptions & Freezes
    "FREEZE_NOT_ALLOWED",
    "ALREADY_FROZEN",
    "NOT_ACTIVE",
    "PAYMENT_OVERDUE",
    "COUNT_EXHAUSTED",
    "DAYS_EXHAUSTED",
    "REQUEST_EXCEEDS_REMAINING",
    "NOT_FROZEN",
    "INVALID_SUBSCRIPTION",
    "NO_ACTIVE_SUBSCRIPTION",

    // B05: Access, Classes, Visitors
    "VISITOR_NOT_FOUND",
    "SCHEDULE_NOT_FOUND",
    "NOT_RUNNING",
    "CLASS_NOT_TODAY",
    "CLASS_NOT_STARTED",
    "CLASS_ENDED",
    "CLASS_CANCELLED",
    "CLASS_OUT_OF_TIME",
    "NO_FLOOR_ACCESS",
    "NO_SESSIONS_LEFT",

    // B06: Shifts & Expenses
    "SHIFT_ALREADY_OPEN",
    "SHIFT_NOT_FOUND",
    "ALREADY_CLOSED",
    "NOT_OWNER",
    "EXPENSE_NOT_FOUND",
    "INVALID_RANGE",

    // B07: Coach Operations, Breaks, Rotations
    "COACH_NOT_FOUND",
    "INVALID_COACH",
    "COACH_CAN_ONLY_REQUEST_FOR_SELF",
    "NOT_ON_SHIFT",
    "COACH_ALREADY_ON_BREAK",
    "ANOTHER_COACH_ON_BREAK",
    "DAILY_LIMIT_REACHED",
    "NO_COACH_AVAILABLE",

    // B08: Commissions & Payroll
    "NO_TIERS_CONFIGURED",
    "TIERS_MUST_START_AT_ZERO",
    "DUPLICATE_TIER_THRESHOLD",
    "PERCENT_OUT_OF_RANGE",
    "RUN_NOT_FOUND",
    "RUN_EXISTS",
    "RUN_CLOSED",
    "RUN_ALREADY_CLOSED",
    "PREVIOUS_RUN_OPEN",

    // B09: Notifications & Super Admin
    "SLUG_EXISTS",
    "EMAIL_EXISTS",
    "PHONE_ALREADY_EXISTS",
  ];

  it("should have a non-empty Arabic translation for every error code in the B01-B09 specs", () => {
    const arDict = getDictionary("ar");
    const errors = (arDict as any).errors || {};

    for (const code of ALL_SPEC_ERROR_CODES) {
      const translated = translateErrorCode(code, "ar");
      expect(translated).toBeDefined();
      expect(translated).not.toBe("حدث خطأ غير متوقع");
      expect(errors[code]).toBeDefined();
      expect(errors[code].length).toBeGreaterThan(0);
    }
  });

  it("should have a non-empty English translation for every error code in the B01-B09 specs", () => {
    const enDict = getDictionary("en");
    const errors = (enDict as any).errors || {};

    for (const code of ALL_SPEC_ERROR_CODES) {
      const translated = translateErrorCode(code, "en");
      expect(translated).toBeDefined();
      expect(translated).not.toBe("An unexpected error occurred");
      expect(errors[code]).toBeDefined();
      expect(errors[code].length).toBeGreaterThan(0);
    }
  });

  it("should return the fallback string for unknown error codes gracefully", () => {
    expect(translateErrorCode("NON_EXISTENT_CODE_123", "ar")).toBe("حدث خطأ غير متوقع");
    expect(translateErrorCode("NON_EXISTENT_CODE_123", "en")).toBe("An unexpected error occurred");
  });
});
