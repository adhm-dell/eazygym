import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CommissionsService } from "../commissions/commissions.service";
import {
  activationDecision,
  isOverdue,
  canFreeze,
  settleFreeze,
  endDateAfterFreeze,
  type AccessSubscription,
} from "@gym/domain";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type {
  FreezeSubscriptionDto,
  UnfreezeSubscriptionDto,
  CancelSubscriptionDto,
  ChangeCoachDto,
  LogPtSessionDto,
} from "@gym/contracts";

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly commissionsService: CommissionsService
  ) {}

  /**
   * Helper called inside invoice creation transaction to create a subscription row from a cart item.
   */
  async createFromItem(
    tx: any,
    params: {
      gymId: string;
      invoiceId: string;
      invoiceItemId: string;
      memberId: string;
      plan: any;
      netPricePiasters: number;
      allocatedCollectedPiasters: number;
      options?: {
        startDate?: string;
        coachId?: string;
        classSlotIds?: string[];
        freezeMaxCount?: number;
        freezeMaxTotalDays?: number;
        bundleId?: string;
      };
      createdById: string;
      now?: Date;
    }
  ) {
    const now = params.now || new Date();
    const gym = await tx.gym.findUnique({ where: { id: params.gymId } });

    let requestedStart = params.options?.startDate
      ? new Date(params.options.startDate)
      : new Date(now);

    // Early renewal rule:
    // If the member already has a non-cancelled subscription of the same kind,
    // whose endDate is later than requested start, chain immediately after its endDate.
    const existingActive = await tx.subscription.findMany({
      where: {
        gymId: params.gymId,
        memberId: params.memberId,
        kind: params.plan.kind,
        status: { not: "CANCELLED" },
        endDate: { gt: requestedStart },
      },
      orderBy: { endDate: "desc" },
    });

    if (existingActive.length > 0) {
      const latestEnd = existingActive[0].endDate;
      requestedStart = new Date(latestEnd.getTime() + 1000);
    }

    const durationDays = params.plan.durationDays;
    const endDate = new Date(requestedStart.getTime() + durationDays * 86400000);
    const originalEndDate = new Date(endDate);

    const minUpfrontPercent =
      params.plan.minUpfrontPercent !== null
        ? Number(params.plan.minUpfrontPercent)
        : Number(gym.defaultMinUpfrontPercent);

    const dueAfterDays =
      params.plan.dueAfterDays !== null
        ? params.plan.dueAfterDays
        : gym.defaultDueAfterDays;

    const dueAfterPercent =
      params.plan.dueAfterPercent !== null
        ? Number(params.plan.dueAfterPercent)
        : gym.defaultDueAfterPercent !== null
        ? Number(gym.defaultDueAfterPercent)
        : null;

    const activation = activationDecision({
      total: params.netPricePiasters,
      collected: params.allocatedCollectedPiasters,
      minUpfrontPercent,
    });

    const status = activation.canActivate ? "ACTIVE" : "PENDING_PAYMENT";
    const activatedAt = activation.canActivate ? now : null;

    const freezeMaxCount =
      params.options?.freezeMaxCount !== undefined
        ? params.options.freezeMaxCount
        : params.plan.freezeMaxCount;

    const freezeMaxTotalDays =
      params.options?.freezeMaxTotalDays !== undefined
        ? params.options.freezeMaxTotalDays
        : params.plan.freezeMaxTotalDays;

    const sub = await tx.subscription.create({
      data: {
        gymId: params.gymId,
        memberId: params.memberId,
        planId: params.plan.id,
        invoiceItemId: params.invoiceItemId,
        bundleId: params.options?.bundleId || null,
        kind: params.plan.kind,
        status,
        price: piastersToDecimal(params.netPricePiasters),
        durationDays,
        startDate: requestedStart,
        endDate,
        originalEndDate,
        activatedAt,
        totalSessions: params.plan.totalSessions,
        usedSessions: 0,
        freezeMaxCount,
        freezeMaxTotalDays,
        freezeUsedCount: 0,
        freezeUsedDays: 0,
        minUpfrontPercent,
        dueAfterDays,
        dueAfterPercent,
        commissionMilestones: params.plan.commissionMilestones,
        maxInvitations: params.plan.maxInvitations,
        usedInvitations: 0,
        freePtSessions: params.plan.freePtSessions,
        createdById: params.createdById,
      },
    });

    // PT Coach assignment
    if (params.plan.kind === "PT" && params.options?.coachId) {
      await tx.coachAssignment.create({
        data: {
          subscriptionId: sub.id,
          coachId: params.options.coachId,
          fromDate: requestedStart,
          toDate: null,
        },
      });

      await tx.coachTrainee.upsert({
        where: {
          gymId_coachId_memberId: {
            gymId: params.gymId,
            coachId: params.options.coachId,
            memberId: params.memberId,
          },
        },
        update: { isActive: true },
        create: {
          gymId: params.gymId,
          coachId: params.options.coachId,
          memberId: params.memberId,
          isActive: true,
          freeSessionsGranted: params.plan.freePtSessions || 0,
        },
      });

      // Generate commission milestones
      await this.commissionsService.generateMilestones(
        tx,
        params.gymId,
        {
          id: sub.id,
          price: sub.price,
          commissionMilestones: sub.commissionMilestones || 1,
          startDate: sub.startDate,
          durationDays: sub.durationDays,
        },
        params.options.coachId
      );
    }

    // CLASS Slots assignment
    if (params.plan.kind === "CLASS" && params.options?.classSlotIds?.length) {
      for (const slotId of params.options.classSlotIds) {
        await tx.subscriptionClassSlot.create({
          data: {
            subscriptionId: sub.id,
            classScheduleId: slotId,
          },
        });
      }
    }

    return sub;
  }

  /**
   * Recomputes subscription statuses from current facts in DB.
   */
  async recompute(tx: any, subscriptionIds: string[], now: Date = new Date()) {
    if (subscriptionIds.length === 0) return;

    const subs = await tx.subscription.findMany({
      where: { id: { in: subscriptionIds } },
      include: {
        freezes: { where: { endedAt: null } },
        invoiceItem: {
          include: { allocations: true },
        },
      },
    });

    for (const s of subs) {
      if (s.status === "CANCELLED" || s.cancelledAt) {
        continue;
      }

      const totalAmount = decimalToPiasters(s.price);
      const collected = (s.invoiceItem?.allocations || []).reduce(
        (sum: number, alloc: any) => sum + decimalToPiasters(alloc.amount),
        0
      );

      const hasActiveFreeze = s.freezes.length > 0;
      const minUpfront = Number(s.minUpfrontPercent);
      const activation = activationDecision({
        total: totalAmount,
        collected,
        minUpfrontPercent: minUpfront,
      });

      let nextStatus = s.status;

      if (!activation.canActivate) {
        nextStatus = "PENDING_PAYMENT";
      } else if (hasActiveFreeze) {
        nextStatus = "FROZEN";
      } else if (now.getTime() > s.endDate.getTime()) {
        nextStatus = "EXPIRED";
      } else {
        const overdue = isOverdue({
          total: totalAmount,
          collected,
          startDate: s.startDate,
          durationDays: s.durationDays,
          now,
          dueAfterDays: s.dueAfterDays,
          dueAfterPercent: s.dueAfterPercent ? Number(s.dueAfterPercent) : undefined,
        });

        if (overdue) {
          nextStatus = "SUSPENDED_UNPAID";
        } else {
          nextStatus = "ACTIVE";
        }
      }

      if (nextStatus !== s.status) {
        await tx.subscription.update({
          where: { id: s.id },
          data: {
            status: nextStatus,
            activatedAt:
              nextStatus === "ACTIVE" && !s.activatedAt ? now : s.activatedAt,
          },
        });
      }
    }
  }

  async list(gymId: string, filters: any) {
    const where: any = { gymId };
    if (filters.status) where.status = filters.status;
    if (filters.kind) where.kind = filters.kind;
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.coachId) {
      where.assignments = {
        some: { coachId: filters.coachId, toDate: null },
      };
    }

    const items = await this.prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true } },
        plan: { select: { id: true, name: true, kind: true } },
        assignments: {
          where: { toDate: null },
          include: { coach: { select: { id: true, name: true } } },
        },
        invoiceItem: {
          include: { allocations: true },
        },
        freezes: true,
      },
    });

    const now = new Date();
    return items.map((s) => {
      const totalAmount = decimalToPiasters(s.price);
      const collected = (s.invoiceItem?.allocations || []).reduce(
        (sum, a) => sum + decimalToPiasters(a.amount),
        0
      );
      const remaining = Math.max(0, totalAmount - collected);
      const daysLeft = Math.max(0, Math.ceil((s.endDate.getTime() - now.getTime()) / 86400000));

      return {
        id: s.id,
        gymId: s.gymId,
        member: s.member,
        plan: s.plan,
        kind: s.kind,
        status: s.status,
        price: totalAmount,
        collected,
        remaining,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        durationDays: s.durationDays,
        daysLeft,
        sessionsLeft: s.totalSessions !== null ? Math.max(0, s.totalSessions - s.usedSessions) : null,
        totalSessions: s.totalSessions,
        usedSessions: s.usedSessions,
        freezeRemainingCount: Math.max(0, s.freezeMaxCount - s.freezeUsedCount),
        freezeRemainingDays: Math.max(0, s.freezeMaxTotalDays - s.freezeUsedDays),
        activeCoach: s.assignments[0]?.coach || null,
        freezes: s.freezes,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }

  async getMemberSubscriptions(gymId: string, memberId: string) {
    return this.list(gymId, { memberId });
  }

  async freeze(gymId: string, actorId: string, id: string, dto: FreezeSubscriptionDto) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
      include: {
        freezes: { where: { endedAt: null } },
        invoiceItem: { include: { allocations: true } },
      },
    });

    if (!sub) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Subscription not found",
      });
    }

    const now = new Date();
    const totalAmount = decimalToPiasters(sub.price);
    const collected = (sub.invoiceItem?.allocations || []).reduce(
      (sum, a) => sum + decimalToPiasters(a.amount),
      0
    );

    const overdue = isOverdue({
      total: totalAmount,
      collected,
      startDate: sub.startDate,
      durationDays: sub.durationDays,
      now,
      dueAfterDays: sub.dueAfterDays,
      dueAfterPercent: sub.dueAfterPercent ? Number(sub.dueAfterPercent) : undefined,
    });

    const isFrozen = sub.freezes.length > 0 || sub.status === "FROZEN";
    const isActive = sub.status === "ACTIVE";

    const decision = canFreeze(
      {
        isFrozen,
        isActive,
        overdue,
        maxCount: sub.freezeMaxCount,
        maxTotalDays: sub.freezeMaxTotalDays,
        usedCount: sub.freezeUsedCount,
        usedDays: sub.freezeUsedDays,
      },
      dto.days
    );

    if (!decision.ok) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: decision.reason,
        message: `Freeze denied: ${decision.reason}`,
      });
    }

    const startedAt = dto.startsAt ? new Date(dto.startsAt) : now;
    const plannedEndAt = dto.days
      ? new Date(startedAt.getTime() + dto.days * 86400000)
      : null;

    const result = await this.prisma.runInTransaction(async (tx) => {
      const freezeRow = await tx.subscriptionFreeze.create({
        data: {
          subscriptionId: sub.id,
          startedAt,
          plannedEndAt,
          endedAt: null,
          reason: dto.reason || null,
          createdById: actorId,
        },
      });

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: "FROZEN",
          freezeUsedCount: sub.freezeUsedCount + 1,
        },
      });

      return freezeRow;
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SUBSCRIPTION_FREEZE",
      entityType: "Subscription",
      entityId: sub.id,
      after: result,
    });

    return result;
  }

  async unfreeze(gymId: string, actorId: string, id: string, dto: UnfreezeSubscriptionDto) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
      include: {
        freezes: { where: { endedAt: null }, orderBy: { startedAt: "desc" } },
      },
    });

    if (!sub || sub.freezes.length === 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NOT_FROZEN",
        message: "Subscription does not have an active freeze",
      });
    }

    const activeFreeze = sub.freezes[0];
    if (!activeFreeze) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NOT_FROZEN",
        message: "Subscription does not have an active freeze",
      });
    }

    const now = new Date();
    const remainingFreezeDays = Math.max(0, sub.freezeMaxTotalDays - sub.freezeUsedDays);

    const settled = settleFreeze({
      startedAt: activeFreeze.startedAt,
      endedAt: now,
      remainingDays: remainingFreezeDays,
    });

    const newEndDate = endDateAfterFreeze(sub.endDate, settled.days);

    await this.prisma.runInTransaction(async (tx) => {
      await tx.subscriptionFreeze.update({
        where: { id: activeFreeze.id },
        data: {
          endedAt: now,
          days: settled.days,
        },
      });

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          endDate: newEndDate,
          freezeUsedDays: sub.freezeUsedDays + settled.days,
        },
      });

      await this.recompute(tx, [sub.id], now);

      await this.commissionsService.shiftPendingMilestones(
        tx,
        sub.id,
        settled.days,
        now
      );
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SUBSCRIPTION_UNFREEZE",
      entityType: "Subscription",
      entityId: sub.id,
      after: { settledDays: settled.days, newEndDate },
    });

    return {
      success: true,
      settledDays: settled.days,
      newEndDate: newEndDate.toISOString(),
    };
  }

  async cancel(gymId: string, actorId: string, id: string, dto: CancelSubscriptionDto) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
    });

    if (!sub) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Subscription not found",
      });
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    await this.commissionsService.voidUnearned(this.prisma, id);

    await this.auditService.log({
      gymId,
      actorId,
      action: "SUBSCRIPTION_CANCEL",
      entityType: "Subscription",
      entityId: id,
      after: { reason: dto.reason },
    });

    return updated;
  }

  async changeCoach(gymId: string, actorId: string, id: string, dto: ChangeCoachDto) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
      include: {
        assignments: { where: { toDate: null } },
      },
    });

    if (!sub || sub.kind !== "PT") {
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_SUBSCRIPTION",
        message: "Change coach is only applicable to active PT subscriptions",
      });
    }

    const currentAssignment = sub.assignments[0];
    if (currentAssignment && currentAssignment.coachId === dto.newCoachId) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "INVALID_COACH",
        message: "New coach cannot be the same as current coach",
      });
    }

    const newCoach = await this.prisma.staff.findFirst({
      where: { id: dto.newCoachId, gymId, role: "COACH", isActive: true },
    });

    if (!newCoach) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "INVALID_COACH",
        message: "New coach is not an active coach in this gym",
      });
    }

    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();

    await this.prisma.runInTransaction(async (tx) => {
      if (currentAssignment) {
        await tx.coachAssignment.update({
          where: { id: currentAssignment.id },
          data: { toDate: effectiveAt },
        });
      }

      await tx.coachAssignment.create({
        data: {
          subscriptionId: sub.id,
          coachId: dto.newCoachId,
          fromDate: effectiveAt,
          toDate: null,
          reason: dto.reason || null,
        },
      });

      await tx.coachTrainee.upsert({
        where: {
          gymId_coachId_memberId: {
            gymId,
            coachId: dto.newCoachId,
            memberId: sub.memberId,
          },
        },
        update: { isActive: true },
        create: {
          gymId,
          coachId: dto.newCoachId,
          memberId: sub.memberId,
          isActive: true,
        },
      });

      if (currentAssignment) {
        await this.commissionsService.handleCoachTransfer(
          tx,
          sub.id,
          currentAssignment.coachId,
          dto.newCoachId,
          effectiveAt
        );
      }
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SUBSCRIPTION_CHANGE_COACH",
      entityType: "Subscription",
      entityId: id,
      after: { newCoachId: dto.newCoachId, reason: dto.reason },
    });

    return { success: true };
  }

  async logSession(gymId: string, actorId: string, id: string, dto: LogPtSessionDto) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
    });

    if (!sub || sub.kind !== "PT") {
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_SUBSCRIPTION",
        message: "Session logging only applicable to PT subscriptions",
      });
    }

    if (sub.totalSessions !== null && sub.usedSessions >= sub.totalSessions) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_SESSIONS_LEFT",
        message: "No sessions left in this subscription",
      });
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        usedSessions: sub.usedSessions + 1,
      },
    });

    return {
      success: true,
      usedSessions: updated.usedSessions,
      sessionsLeft:
        updated.totalSessions !== null
          ? Math.max(0, updated.totalSessions - updated.usedSessions)
          : null,
    };
  }

  async buildAccessInput(
    gymId: string,
    memberId: string,
    now: Date
  ): Promise<AccessSubscription[]> {
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const subscriptions = await this.prisma.subscription.findMany({
      where: { gymId, memberId },
      include: {
        plan: true,
        freezes: true,
        invoiceItem: {
          include: {
            allocations: true,
          },
        },
        classSlots: {
          include: {
            classSchedule: {
              include: {
                exceptions: {
                  where: { date: todayDate },
                },
                sessions: {
                  where: { date: todayDate },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return subscriptions.map((sub): AccessSubscription => {
      const isFrozen = sub.freezes.some(
        (f) => !f.endedAt && f.startedAt <= now
      );

      let totalPiasters = 0;
      let collectedPiasters = 0;

      if (sub.invoiceItem) {
        totalPiasters = decimalToPiasters(sub.invoiceItem.total);
        collectedPiasters = sub.invoiceItem.allocations.reduce(
          (sum, a) => sum + decimalToPiasters(a.amount),
          0
        );
      }

      const durationDays = Math.max(
        1,
        Math.round((sub.endDate.getTime() - sub.startDate.getTime()) / 86400000)
      );

      const overdue = isOverdue({
        total: totalPiasters,
        collected: collectedPiasters,
        startDate: sub.startDate,
        durationDays,
        now,
        dueAfterDays: sub.plan.dueAfterDays ?? undefined,
        dueAfterPercent: sub.plan.dueAfterPercent ? Number(sub.plan.dueAfterPercent) : undefined,
      });

      const classSlots = sub.classSlots.map((cs) => {
        const sched = cs.classSchedule;
        const ex = sched.exceptions[0];
        const run = sched.sessions[0];

        const parseMinutes = (timeStr: string) => {
          const [h, m] = timeStr.split(":").map(Number);
          return (h || 0) * 60 + (m || 0);
        };

        return {
          id: sched.id,
          dayOfWeek: sched.dayOfWeek,
          startMinutes: parseMinutes(sched.startTime),
          endMinutes: parseMinutes(sched.endTime),
          todayCancelled: ex?.isCancelled ?? false,
          todayStartMinutes: ex?.newStartTime ? parseMinutes(ex.newStartTime) : undefined,
          todayEndMinutes: ex?.newEndTime ? parseMinutes(ex.newEndTime) : undefined,
          todayRun: run ? { startedAt: run.startedAt, endedAt: run.endedAt } : null,
        };
      });

      return {
        id: sub.id,
        kind: sub.kind as any,
        grantsFloorAccess: sub.plan.grantsFloorAccess,
        startDate: sub.startDate,
        endDate: sub.endDate,
        cancelled: sub.status === "CANCELLED",
        activated: sub.status !== "PENDING_PAYMENT",
        frozen: isFrozen,
        overdue,
        sessionsLeft:
          sub.totalSessions !== null
            ? Math.max(0, sub.totalSessions - sub.usedSessions)
            : null,
        classSlots,
      };
    });
  }
}
