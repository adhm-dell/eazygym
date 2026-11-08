import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(gymId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const [
      paymentsToday,
      openShifts,
      expiringCount,
      overdueSubs,
      pendingDiscounts,
      pendingBreaks,
      classesToday,
      newMembersToday,
      entriesToday,
    ] = await Promise.all([
      // 1. Payments today
      this.prisma.payment.findMany({
        where: {
          gymId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // 2. Open shifts
      this.prisma.shift.findMany({
        where: { gymId, status: "OPEN" },
        include: { staff: true },
      }),

      // 3. Expiring subscriptions in next 7 days
      this.prisma.subscription.count({
        where: {
          gymId,
          status: "ACTIVE",
          endDate: { gte: now, lte: in7Days },
        },
      }),

      // 4. Overdue balances
      this.prisma.subscription.findMany({
        where: {
          gymId,
          status: { in: ["ACTIVE", "SUSPENDED_UNPAID", "PENDING_PAYMENT"] },
        },
        include: {
          invoiceItem: { include: { allocations: true } },
        },
      }),

      // 5. Invoices pending manual discount approval
      this.prisma.invoice.count({
        where: {
          gymId,
          discount: { gt: 0 },
          promotionId: null,
          discountApprovedById: null,
        },
      }),

      // 6. Pending break requests
      this.prisma.coachBreak.count({
        where: {
          gymId,
          status: "PENDING",
        },
      }),

      // 7. Today's classes
      this.prisma.classSchedule.findMany({
        where: {
          gymId,
          dayOfWeek: now.getDay(),
          isActive: true,
        },
      }),

      // 8. New members registered today
      this.prisma.member.count({
        where: {
          gymId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // 9. Entries / Check-ins today
      this.prisma.accessLog.count({
        where: {
          gymId,
          scannedAt: { gte: startOfDay, lte: endOfDay },
          allowed: true,
        },
      }),
    ]);

    // Aggregate revenues
    let totalRevenue = 0;
    const byMethod = { cash: 0, card: 0, wallet: 0, instapay: 0, transfer: 0 };
    for (const p of paymentsToday) {
      const amt = Number(p.amount);
      totalRevenue += amt;
      const m = p.method.toLowerCase();
      if (m === "instapay") {
        byMethod.instapay += amt;
        byMethod.transfer += amt;
      } else if (byMethod[m as keyof typeof byMethod] !== undefined) {
        byMethod[m as keyof typeof byMethod] += amt;
      }
    }

    // Overdue summary
    let overdueCount = 0;
    let totalOverdueAmount = 0;
    for (const sub of overdueSubs) {
      if (!sub.invoiceItem) continue;
      const total = Number(sub.invoiceItem.total);
      const collected = sub.invoiceItem.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const remaining = Math.max(0, total - collected);
      if (remaining > 0) {
        overdueCount++;
        totalOverdueAmount += remaining;
      }
    }

    // Open shifts expected cash
    let totalExpectedCash = 0;
    const shiftSummaries = openShifts.map((s) => {
      const cash = Number(s.openingCash || 0);
      totalExpectedCash += cash;
      return {
        id: s.id,
        staffName: s.staff.name,
        openedAt: s.openedAt.toISOString(),
        openingCash: cash,
      };
    });

    return {
      revenue: {
        total: totalRevenue,
        byMethod,
      },
      openShifts: {
        count: openShifts.length,
        totalExpectedCash,
        shifts: shiftSummaries,
      },
      expiringSubscriptions: {
        count: expiringCount,
      },
      overdueBalances: {
        count: overdueCount,
        totalAmount: totalOverdueAmount,
      },
      pendingDiscounts: {
        count: pendingDiscounts,
      },
      pendingBreaks: {
        count: pendingBreaks,
      },
      classesToday: {
        total: classesToday.length,
        items: classesToday.map((c) => ({
          id: c.id,
          name: c.name || "حصة جماعية",
          time: c.startTime,
          state: "SCHEDULED",
        })),
      },
      newMembersToday,
      entriesToday,
    };
  }
}
