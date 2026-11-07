import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  toMinor,
  fromMinor,
  buildMilestones,
  allocateCollected,
  shiftPendingMilestones as domainShiftPending,
  validateTiers,
  pickTier,
  monthlyCommission,
  splitOnTransfer,
  TierConfigError,
  type Tier,
  type HeldMilestone,
} from "@gym/domain";
import { CommissionEntryStatus } from "@gym/db";
import type { CommissionTierItem } from "@gym/contracts";

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get configured commission tiers for a coach or gym default (coachId: null).
   */
  async getTiers(gymId: string, coachId?: string | null) {
    if (coachId) {
      const coachTiers = await this.prisma.commissionTier.findMany({
        where: { gymId, coachId },
        orderBy: { minRevenue: "asc" },
      });
      if (coachTiers.length > 0) {
        return coachTiers.map((t) => ({
          id: t.id,
          minRevenue: Number(t.minRevenue),
          percent: Number(t.percent),
          coachId: t.coachId,
        }));
      }
    }

    const defaultTiers = await this.prisma.commissionTier.findMany({
      where: { gymId, coachId: null },
      orderBy: { minRevenue: "asc" },
    });

    return defaultTiers.map((t) => ({
      id: t.id,
      minRevenue: Number(t.minRevenue),
      percent: Number(t.percent),
      coachId: null,
    }));
  }

  /**
   * Atomically set tiers for a coach or gym default.
   */
  async setTiers(
    gymId: string,
    coachId: string | null | undefined,
    tiers: CommissionTierItem[]
  ) {
    const domainTiers: Tier[] = tiers.map((t) => ({
      minRevenue: toMinor(t.minRevenue),
      percent: t.percent,
    }));

    try {
      validateTiers(domainTiers);
    } catch (err: any) {
      if (err instanceof TierConfigError) {
        throw new BadRequestException({
          statusCode: 400,
          code: err.message,
          message: `Tier validation error: ${err.message}`,
        });
      }
      throw err;
    }

    const targetCoachId = coachId || null;

    return this.prisma.$transaction(async (tx) => {
      await tx.commissionTier.deleteMany({
        where: { gymId, coachId: targetCoachId },
      });

      await tx.commissionTier.createMany({
        data: tiers.map((t) => ({
          gymId,
          coachId: targetCoachId,
          minRevenue: t.minRevenue,
          percent: t.percent,
        })),
      });

      const updated = await tx.commissionTier.findMany({
        where: { gymId, coachId: targetCoachId },
        orderBy: { minRevenue: "asc" },
      });

      return updated.map((t) => ({
        id: t.id,
        minRevenue: Number(t.minRevenue),
        percent: Number(t.percent),
        coachId: t.coachId,
      }));
    });
  }

  /**
   * Generates commission milestones AT SALE for a commissionable PT subscription.
   */
  async generateMilestones(
    tx: any,
    gymId: string,
    subscription: {
      id: string;
      price: any;
      commissionMilestones: number;
      startDate: Date;
      durationDays: number;
    },
    initialCoachId: string
  ) {
    const priceMinor = toMinor(Number(subscription.price));
    const count = subscription.commissionMilestones || 1;

    const milestones = buildMilestones({
      price: priceMinor,
      milestones: count,
      startDate: new Date(subscription.startDate),
      durationDays: subscription.durationDays,
    });

    for (const m of milestones) {
      await tx.commissionEntry.upsert({
        where: {
          subscriptionId_milestoneIndex_coachId: {
            subscriptionId: subscription.id,
            milestoneIndex: m.index,
            coachId: initialCoachId,
          },
        },
        update: {
          periodStart: m.periodStart,
          dueDate: m.dueDate,
          baseAmount: fromMinor(m.base),
        },
        create: {
          gymId,
          subscriptionId: subscription.id,
          coachId: initialCoachId,
          milestoneIndex: m.index,
          periodStart: m.periodStart,
          dueDate: m.dueDate,
          baseAmount: fromMinor(m.base),
          shareBps: 10000,
          allocatedBase: 0,
          status: CommissionEntryStatus.PENDING,
        },
      });
    }
  }

  /**
   * Recompute allocation of collected money across milestones (waterfall).
   * Called after every payment, refund, or void.
   */
  async recomputeAllocation(tx: any, gymId: string, subscriptionId: string) {
    const sub = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: { invoiceItem: true },
    });

    if (!sub || !sub.invoiceItemId) return;

    // Sum payment allocations of this subscription's invoice item
    const allocations = await tx.paymentAllocation.findMany({
      where: { invoiceItemId: sub.invoiceItemId },
    });

    const collectedMinor = allocations.reduce(
      (sum: number, a: any) => sum + toMinor(Number(a.amount)),
      0
    );

    // Fetch entries
    const entries = await tx.commissionEntry.findMany({
      where: { subscriptionId },
      orderBy: { milestoneIndex: "asc" },
    });

    if (entries.length === 0) return;

    // Deduplicate milestone indices
    const uniqueIndices: number[] = Array.from(new Set<number>(entries.map((e: any) => Number(e.milestoneIndex)))).sort(
      (a, b) => a - b
    );

    const milestoneBases = uniqueIndices.map((idx) => {
      const match = entries.find((e: any) => e.milestoneIndex === idx);
      return { base: toMinor(Number(match.baseAmount)) };
    });

    const allocatedSlices = allocateCollected(collectedMinor, milestoneBases);

    const now = new Date();

    for (let i = 0; i < uniqueIndices.length; i++) {
      const idx = uniqueIndices[i];
      const sliceMinor = allocatedSlices[i] || 0;
      const sliceDecimal = fromMinor(sliceMinor);

      const matchingRows = entries.filter((e: any) => e.milestoneIndex === idx);
      for (const row of matchingRows) {
        let newStatus = row.status;
        if (row.status === CommissionEntryStatus.PENDING && new Date(row.dueDate) <= now) {
          newStatus = CommissionEntryStatus.EARNED;
        }

        await tx.commissionEntry.update({
          where: { id: row.id },
          data: {
            allocatedBase: sliceDecimal,
            status: newStatus,
          },
        });
      }
    }
  }

  /**
   * Shift pending milestones forward on freeze.
   */
  async shiftPendingMilestones(
    tx: any,
    subscriptionId: string,
    freezeDays: number,
    now: Date
  ) {
    const entries = await tx.commissionEntry.findMany({
      where: {
        subscriptionId,
        payrollRunId: null,
        status: { in: [CommissionEntryStatus.PENDING, CommissionEntryStatus.EARNED] },
      },
    });

    const domainInput: Array<{ id: string; dueDate: Date; periodStart: Date }> = entries.map((e: any) => ({
      id: e.id,
      dueDate: new Date(e.dueDate),
      periodStart: new Date(e.periodStart),
    }));

    const shifted = domainShiftPending(domainInput, now, freezeDays);

    for (const s of shifted) {
      await tx.commissionEntry.update({
        where: { id: s.id },
        data: {
          periodStart: s.periodStart,
          dueDate: s.dueDate,
        },
      });
    }
  }

  /**
   * Void unearned entries when subscription is cancelled or voided.
   */
  async voidUnearned(tx: any, subscriptionId: string) {
    await tx.commissionEntry.updateMany({
      where: {
        subscriptionId,
        payrollRunId: null,
      },
      data: {
        status: CommissionEntryStatus.VOID,
      },
    });
  }

  /**
   * Split milestones on coach transfer.
   */
  async handleCoachTransfer(
    tx: any,
    subscriptionId: string,
    oldCoachId: string,
    newCoachId: string,
    transferAt: Date
  ) {
    const entries = await tx.commissionEntry.findMany({
      where: {
        subscriptionId,
        coachId: oldCoachId,
        payrollRunId: null,
        status: { not: CommissionEntryStatus.VOID },
      },
    });

    const heldMilestones: HeldMilestone[] = entries.map((e: any) => ({
      index: e.milestoneIndex,
      periodStart: new Date(e.periodStart),
      dueDate: new Date(e.dueDate),
      heldBps: e.shareBps,
    }));

    const splits = splitOnTransfer(heldMilestones, transferAt);

    for (const split of splits) {
      const oldEntry = entries.find((e: any) => e.milestoneIndex === split.index);
      if (!oldEntry) continue;

      if (split.oldKeepsBps === 0 && split.newGetsBps > 0) {
        // Full transfer to new coach
        await tx.commissionEntry.update({
          where: { id: oldEntry.id },
          data: {
            coachId: newCoachId,
            shareBps: split.newGetsBps,
          },
        });
      } else if (split.oldKeepsBps > 0 && split.newGetsBps > 0) {
        // Split between old and new
        await tx.commissionEntry.update({
          where: { id: oldEntry.id },
          data: {
            shareBps: split.oldKeepsBps,
          },
        });

        await tx.commissionEntry.create({
          data: {
            gymId: oldEntry.gymId,
            subscriptionId: oldEntry.subscriptionId,
            coachId: newCoachId,
            milestoneIndex: oldEntry.milestoneIndex,
            periodStart: oldEntry.periodStart,
            dueDate: oldEntry.dueDate,
            baseAmount: oldEntry.baseAmount,
            shareBps: split.newGetsBps,
            allocatedBase: oldEntry.allocatedBase,
            status: oldEntry.status,
          },
        });
      }
    }
  }

  /**
   * Get coach's performance numbers, revenue, and commission for a month.
   */
  async getCoachMonthlyCommission(
    gymId: string,
    coachId: string,
    year: number,
    month: number
  ) {
    const coach = await this.prisma.staff.findFirst({
      where: { id: coachId, gymId },
    });

    if (!coach) {
      throw new NotFoundException({
        statusCode: 404,
        code: "COACH_NOT_FOUND",
        message: `Coach ${coachId} not found`,
      });
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // 1. Collected revenue of coach for PT in this month
    const allocations = await this.prisma.paymentAllocation.findMany({
      where: {
        gymId,
        coachId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const collectedMinor = allocations.reduce(
      (sum, a) => sum + toMinor(Number(a.amount)),
      0
    );

    // 2. Tiers
    const rawTiers = await this.getTiers(gymId, coachId);
    const domainTiers: Tier[] = rawTiers.map((t) => ({
      minRevenue: toMinor(t.minRevenue),
      percent: t.percent,
    }));

    let currentTier: Tier = { minRevenue: 0, percent: 0 };
    if (domainTiers.length > 0) {
      try {
        currentTier = pickTier(domainTiers, collectedMinor);
      } catch {
        currentTier = { minRevenue: 0, percent: 0 };
      }
    }

    // 3. Eligible entries for this month
    const entries = await this.prisma.commissionEntry.findMany({
      where: {
        gymId,
        coachId,
        status: { not: CommissionEntryStatus.VOID },
        dueDate: { lte: monthEnd },
      },
      include: {
        subscription: {
          include: {
            member: { select: { id: true, name: true, code: true } },
            plan: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const domainEntries = entries.map((e) => ({
      allocatedBase: toMinor(Number(e.allocatedBase)),
      shareBps: e.shareBps,
    }));

    const result = monthlyCommission({
      entries: domainEntries,
      tier: currentTier,
    });

    // Next tier progress
    const sortedTiers = [...domainTiers].sort((a, b) => a.minRevenue - b.minRevenue);
    const nextTier = sortedTiers.find((t) => t.minRevenue > collectedMinor);

    return {
      coachId: coach.id,
      coach: {
        id: coach.id,
        name: coach.name,
        email: coach.email,
        baseSalary: Number(coach.baseSalary || 0),
      },
      year,
      month,
      collectedRevenue: fromMinor(collectedMinor),
      tier: {
        minRevenue: fromMinor(currentTier.minRevenue),
        percent: currentTier.percent,
      },
      currentTier: {
        minRevenue: fromMinor(currentTier.minRevenue),
        percent: currentTier.percent,
      },
      nextTier: nextTier
        ? {
            minRevenue: fromMinor(nextTier.minRevenue),
            percent: nextTier.percent,
            neededRevenue: fromMinor(nextTier.minRevenue - collectedMinor),
          }
        : null,
      commissionableBase: fromMinor(result.commissionableBase),
      commissionAmount: fromMinor(result.commission),
      entries: entries.map((e) => ({
        id: e.id,
        subscriptionId: e.subscriptionId,
        milestoneIndex: e.milestoneIndex,
        periodStart: e.periodStart,
        dueDate: e.dueDate,
        baseAmount: Number(e.baseAmount),
        allocatedBase: Number(e.allocatedBase),
        shareBps: e.shareBps,
        status: e.status,
        member: e.subscription.member,
        plan: e.subscription.plan,
      })),
    };
  }
}
