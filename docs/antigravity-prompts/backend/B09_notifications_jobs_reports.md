# B09: Notifications, scheduled jobs, dashboard, reports, super-admin

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`notifications.ts`).

## Notifications
Model: `Notification { recipientType MEMBER|STAFF|ADMIN_BROADCAST, recipientId (ADMIN_BROADCAST: the gymId), type, title/body (store i18n keys + params in `body` JSON-as-text, the client translates), dedupeKey }`. Unique `(dedupeKey, recipientId)` makes every producer idempotent: producers `createMany(skipDuplicates)`.
| Method + path | Roles | Notes |
|---|---|---|
| `GET /notifications` | any logged-in | own + (for admins) the gym broadcast; unread count; paginated. |
| `POST /notifications/:id/read`, `POST /notifications/read-all` | any | broadcast read state is per admin (store a `NotificationRead` row or JSON of reader ids). |
| `GET /notifications/stream` | any | Server-Sent Events; emits new notifications for the user (fan-out in memory, falls back to polling every 30 s). |

### Event catalog (type -> recipients -> dedupeKey)
| Type | Recipients | dedupeKey |
|---|---|---|
| `SUBSCRIPTION_EXPIRING` | member, and the PT coach for PT subs | `sub-expiring:{subId}:{threshold}` (thresholds from `Gym.expiryNotifyDays`, via `nextExpiryReminder`) |
| `SUBSCRIPTION_EXPIRED` | member | `sub-expired:{subId}` |
| `SESSIONS_LOW` (<= 2 left) | member + coach | `sessions-low:{subId}:{n}` |
| `PAYMENT_DUE_SOON` (1 day before `balanceDueDate`) | member | `pay-due:{subId}` |
| `PAYMENT_OVERDUE` (suspended) | member + ADMIN_BROADCAST | `pay-overdue:{subId}` |
| `FREEZE_STARTED/ENDED` | member | `freeze:{freezeId}:{start|end}` |
| `COACH_CHANGED` | member, old + new coach | `coach-change:{assignmentId}` |
| `CLASS_CANCELLED/RESCHEDULED` | registered members | `class-exc:{exceptionId}` |
| `MILESTONE_EARNED` | coach | `milestone:{entryId}` |
| `DISCOUNT_PENDING_APPROVAL` | ADMIN_BROADCAST | `disc:{invoiceId}` |
| `SHIFT_OPEN_TOO_LONG` | ADMIN_BROADCAST | `shift-long:{shiftId}:{yyyymmddhh}` |
| break + rotation events | see B07 | see B07 |

## Scheduled jobs (summary of all phases; each idempotent, logs counts, wrapped in try/catch so one failure does not stop the scheduler; all use the gym timezone)
| Job | Schedule | What |
|---|---|---|
| `breaks.monitor` | every minute | B07 overrun notifications |
| `freezes.autoEnd` | every 5 min | B04 |
| `subscriptions.recomputeAll` | hourly | B04 expire / suspend / notify |
| `classSessions.closeForgotten` | nightly | persist `endedAt` on sessions left open |
| `commission.markEarned` | daily 00:10 | B08 |
| `notifications.expiryReminders` | daily 09:00 | event catalog |
| `shifts.openTooLong` | every 30 min | B06 |
| `idempotency.cleanup` | daily | delete keys older than 24 h |

## Dashboard
`GET /dashboard` (GYM_ADMIN): today's revenue total and by method, open shifts (with expected cash), subscriptions expiring within 7 days (count), overdue balances (count + amount), pending manual discounts, pending break requests, today's classes with state, new members today, entries today.

## Reports (all accept `from`, `to`, and `format=csv`)
- `GET /reports/revenue` by day / method / item kind; `GET /reports/shifts`; `GET /reports/expiring?days=`; `GET /reports/overdue`; `GET /reports/attendance` (by day/hour, denied reasons); `GET /reports/promotions`; `GET /reports/coaches` (trainees, sessions done, collected revenue, tier); `GET /reports/expenses`.
Revenue = sum of `PaymentAllocation` (net of refunds) so it matches commission numbers; wallet top-ups are shown separately (liability, not revenue) and wallet payments are revenue when used.

## Super-admin (platform)
`GET/POST/PATCH /admin/gyms` (SUPER_ADMIN): create gym (slug, timezone), create its first GYM_ADMIN, deactivate (blocks logins, keeps data), cross-gym usage stats.

## Acceptance (e2e)
- Expiry job: with thresholds 7/3/1 a sub ending in 3 days produces ONE notification for the 3-day threshold per recipient; running the job twice creates no duplicates; PT subs notify the coach too.
- Broadcast notification read by admin A is still unread for admin B.
- Revenue report equals the sum of invoices' collected money; a refund reduces it.
- CSV export has the same totals as the JSON.
