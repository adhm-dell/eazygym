# Business Rules

| Area | Rule |
|---|---|
| **Money** | Domain works in integer piasters (Minor units). DB is Decimal(12,2). |
| **Sales** | One `Invoice` for subscriptions, services, and bar products. Split payments = several `Payment` rows (cash + wallet). |
| **Min upfront** | Per plan (falls back to gym default). Below it the subscription stays `PENDING_PAYMENT` and cannot enter. |
| **Overdue** | `dueAfterDays` and/or `dueAfterPercent` of the duration. Past it with a balance => `SUSPENDED_UNPAID`. Suspended days are LOST (end date unchanged). Paying restores access. |
| **Wallet** | Overpayment / receipt voucher credits the wallet. Buying auto-uses the wallet up to the balance. Disbursement voucher pays it out. Never negative. |
| **Freeze** | Limits (count + total days) are snapshotted on the subscription when sold, admin-editable. Not allowed while overdue. Frozen days extend the end date (capped at the allowance). |
| **Class plans** | Default `RECEPTION_STARTS`: reception presses "Start class" (creates a `ClassSession`); members scan in only after that, for the scheduled class length from the ACTUAL start (or until reception ends it). A late coach just means a later start. Only on the member's registered weekday. Alternative `SCHEDULED` mode = fixed timetable window (+ optional early minutes). Cancelled / rescheduled occurrences handled. |
| **Shifts** | Every payment / invoice / expense / voucher needs an open shift. Staff close their own; admin can close any ("close all"). Expected cash = opening + cash payments + cash receipts - drawer expenses - cash disbursements. |
| **Commission** | Milestones generated at sale (price / N, due after each period). Collected money fills milestones in order, so partial payments and late top-ups just recompute. Tier = coach's COLLECTED revenue in the month, applied to the whole month. Finalised when the payroll run closes. |
| **Transfer** | Split by DAYS inside the milestone in progress; past milestones stay with the old coach; future ones move. Transfer day belongs to the new coach. |
| **Tiers** | Must include a 0 threshold. No hidden default percent. |

