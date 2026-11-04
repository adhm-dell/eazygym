# Phase 2 (Staff App): Login, shift gate, Scan/Entry, Start class

Read `00_PROJECT_RULES.md`. Phase 1 is done.

## Build
1. Login, then shift gate: reception/cashier see the current open shift or an "Open shift" form (opening cash). Shift chip stays in the header.
2. **Scan / Entry screen** (home for reception): a big always-focused field. A barcode scanner types the member `code` + Enter; also search by name/phone. The result comes from `evaluateAccess` and is a **full-screen result**: green = allowed, amber = allowed but `expiringSoon`, red = denied. Show member name, plan, days left, and the Arabic reason with the next-action button from the table below. Auto-dismiss on allowed after a few seconds, stay on denied until dismissed. Below: today's recent scans.
3. **Today's classes panel:** for each `ClassSchedule` today show registered members, a **Start class** button (uses `canStartClass`, creates a `ClassSession`) and **End class**. A class member scanned before the class starts sees `CLASS_NOT_STARTED`.
4. Mock data additions: AccessLog, ClassSchedule, ClassSession, class members.

| Code | Arabic message | Next action |
|---|---|---|
| ACTIVE | تفضل بالدخول | none |
| BLOCKED | العضو محظور | view reason |
| NO_SUBSCRIPTION | لا يوجد اشتراك | sell subscription |
| PENDING_PAYMENT | لم يتم دفع الحد الأدنى | collect payment |
| PAYMENT_OVERDUE | الاشتراك متوقف لوجود متبقي مستحق | collect balance |
| FROZEN | الاشتراك مجمّد | unfreeze |
| EXPIRED | الاشتراك منتهي | renew |
| PT_EXPIRED | اشتراك البرايفت منتهي | renew PT |
| NOT_STARTED | الاشتراك لم يبدأ بعد | show start date |
| CANCELLED | الاشتراك ملغي | sell subscription |
| NO_SESSIONS_LEFT | انتهت الجلسات | renew |
| NO_FLOOR_ACCESS | هذا الاشتراك لا يتيح دخول الجيم | sell gym subscription |
| CLASS_NOT_TODAY | ليس يوم الحصة | show class days |
| CLASS_NOT_STARTED | الحصة لم تبدأ بعد | wait / start class |
| CLASS_ENDED | انتهت الحصة | none |
| CLASS_CANCELLED | الحصة ملغية اليوم | none |
| CLASS_OUT_OF_TIME | خارج وقت الحصة | show times |

## Acceptance
- Every code above is reachable from seeded members and renders the right color, message and button.
- A coach "late" scenario works: a class member is denied, reception presses Start class, the same member is then allowed.
- A scan completes with the keyboard only, no mouse.

STOP after this phase.
