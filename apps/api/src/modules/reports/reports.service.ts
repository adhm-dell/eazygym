import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Daily revenue grouped by payment method
   */
  async getDailyRevenue(gymId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999));

    const payments = await this.prisma.payment.findMany({
      where: {
        gymId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const byMethod: Record<string, number> = {
      CASH: 0,
      INSTAPAY: 0,
      CARD: 0,
      WALLET: 0,
      BANK_TRANSFER: 0,
    };

    let totalPiasters = 0;
    for (const p of payments) {
      const piasters = decimalToPiasters(p.amount);
      byMethod[p.method] = (byMethod[p.method] || 0) + piasters;
      totalPiasters += piasters;
    }

    return {
      date: startOfDay.toISOString().slice(0, 10),
      total: totalPiasters / 100,
      totalPiasters,
      byMethod: {
        cash: (byMethod.CASH || 0) / 100,
        instapay: (byMethod.INSTAPAY || 0) / 100,
        card: (byMethod.CARD || 0) / 100,
        wallet: (byMethod.WALLET || 0) / 100,
        bankTransfer: (byMethod.BANK_TRANSFER || 0) / 100,
      },
      paymentCount: payments.length,
    };
  }

  /**
   * Subscriptions expiring within next N days
   */
  async getExpiringSubscriptions(gymId: string, days = 7) {
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 24 * 3600 * 1000);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        gymId,
        status: "ACTIVE",
        endDate: { gte: now, lte: horizon },
      },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true } },
        plan: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { endDate: "asc" },
    });

    return subscriptions.map((s) => ({
      id: s.id,
      member: s.member,
      plan: s.plan,
      endDate: s.endDate.toISOString(),
      daysRemaining: Math.max(0, Math.ceil((s.endDate.getTime() - now.getTime()) / (24 * 3600 * 1000))),
    }));
  }

  /**
   * Overdue subscription balances
   */
  async getOverdueBalances(gymId: string) {
    const now = new Date();
    const overdueSubs = await this.prisma.subscription.findMany({
      where: {
        gymId,
        status: { in: ["ACTIVE", "SUSPENDED_UNPAID", "PENDING_PAYMENT"] },
      },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true } },
        plan: { select: { id: true, name: true, price: true } },
        invoiceItem: {
          include: {
            allocations: true,
          },
        },
      },
    });

    const overdueList: any[] = [];

    for (const sub of overdueSubs) {
      if (!sub.invoiceItem) continue;
      const total = decimalToPiasters(sub.invoiceItem.total);
      const collected = sub.invoiceItem.allocations.reduce(
        (sum, a) => sum + decimalToPiasters(a.amount),
        0
      );
      const remaining = Math.max(0, total - collected);

      if (remaining > 0) {
        overdueList.push({
          id: sub.id,
          member: sub.member,
          plan: sub.plan,
          total: total / 100,
          collected: collected / 100,
          remainingDue: remaining / 100,
          startDate: sub.startDate.toISOString(),
          status: sub.status,
        });
      }
    }

    return overdueList;
  }

  /**
   * Promotion redemptions summary
   */
  async getPromotionUsage(gymId: string) {
    const redemptions = await this.prisma.promotionRedemption.findMany({
      where: { gymId },
      include: {
        promotion: { select: { id: true, name: true, code: true, type: true, value: true } },
        member: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return redemptions.map((r) => ({
      id: r.id,
      promotion: r.promotion,
      member: r.member,
      discountAmount: Number(r.amount),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Coach performance matrix
   */
  async getCoachPerformance(gymId: string, monthStr?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthStr && monthStr.includes("-")) {
      const parts = monthStr.split("-").map((p) => parseInt(p, 10));
      year = parts[0] || year;
      month = parts[1] || month;
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const coaches = await this.prisma.staff.findMany({
      where: { gymId, role: "COACH", isActive: true },
      select: { id: true, name: true, email: true, baseSalary: true },
    });

    const performance = [];

    for (const c of coaches) {
      // Active trainees
      const traineesCount = await this.prisma.coachTrainee.count({
        where: { gymId, coachId: c.id, isActive: true },
      });

      // Sessions in this month
      const sessions = await this.prisma.coachSession.findMany({
        where: {
          gymId,
          coachId: c.id,
          startTime: { gte: monthStart, lte: monthEnd },
        },
      });

      const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;

      // Collected revenue in this month
      const allocations = await this.prisma.paymentAllocation.findMany({
        where: {
          gymId,
          coachId: c.id,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      });

      const collectedPiasters = allocations.reduce(
        (sum, a) => sum + decimalToPiasters(a.amount),
        0
      );

      performance.push({
        coachId: c.id,
        name: c.name,
        email: c.email,
        baseSalary: Number(c.baseSalary || 0),
        activeTrainees: traineesCount,
        totalSessions: sessions.length,
        completedSessions,
        collectedRevenue: collectedPiasters / 100,
      });
    }

    return performance;
  }
}
