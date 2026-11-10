import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  forwardRef,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CommissionsService } from "../commissions/commissions.service";
import { InvoicesService } from "../invoices/invoices.service";
import {
  activationDecision,
  isOverdue,
  canFreeze,
  settleFreeze,
  endDateAfterFreeze,
  splitOnTransfer,
  type HeldMilestone,
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
import { FitnessProfilesService } from "../coach-ops/fitness-profiles.service";

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly commissionsService: CommissionsService,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => FitnessProfilesService))
    private readonly fitnessProfilesService: FitnessProfilesService
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

    // First-time subscription: trigger fitness profile & coach rotation
    const existingProfile = await tx.fitnessProfile.findUnique({
      where: { memberId: params.memberId },
    });

    let rotationResult: any = null;
    if (!existingProfile) {
      const member = await tx.member.findUnique({
        where: { id: params.memberId },
        select: { name: true },
      });
      const fitRes = await this.fitnessProfilesService.createIfFirst(
        params.gymId,
        params.memberId,
        sub.id,
        tx,
        {
          memberName: member?.name,
          planName: params.plan.name,
        },
        params.now
      );
      rotationResult = fitRes.rotation;
    }

    (sub as any).rotation = rotationResult;

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

  async list(gymId: string, filters: any = {}) {
    const where: any = { gymId };
    if (filters.status && filters.status !== "ALL") where.status = filters.status;
    if (filters.kind && filters.kind !== "ALL") where.kind = filters.kind;
    if (filters.planId && filters.planId !== "ALL") where.planId = filters.planId;
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.coachId && filters.coachId !== "ALL") {
      where.assignments = {
        some: { coachId: filters.coachId, toDate: null },
      };
    }
    if (filters.startDate) {
      where.startDate = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.endDate = { lte: new Date(filters.endDate) };
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.member = {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { code: { contains: q } },
        ],
      };
    }

    const items = await this.prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true, isBlocked: true, blockedReason: true } },
        plan: {
          select: {
            id: true,
            name: true,
            kind: true,
            dueAfterDays: true,
            dueAfterPercent: true,
            freezeMaxCount: true,
            freezeMaxTotalDays: true,
          },
        },
        assignments: {
          where: { toDate: null },
          include: { coach: { select: { id: true, name: true } } },
        },
        invoiceItem: {
          include: {
            allocations: true,
            invoice: {
              include: {
                payments: true,
                items: true,
              },
            },
          },
        },
        freezes: true,
      },
    });

    const now = new Date();
    const mapped = items.map((s) => {
      const totalAmount = decimalToPiasters(s.price);
      const collected = (s.invoiceItem?.allocations || []).reduce(
        (sum, a) => sum + decimalToPiasters(a.amount),
        0
      );
      const remaining = Math.max(0, totalAmount - collected);
      const daysLeft = Math.max(0, Math.ceil((s.endDate.getTime() - now.getTime()) / 86400000));

      const isFrozen = (s.freezes || []).some(
        (f) => !f.endedAt && f.startedAt <= now
      );

      const overdueVal = isOverdue({
        total: totalAmount,
        collected,
        startDate: s.startDate,
        durationDays: s.durationDays,
        now,
        dueAfterDays: (s.dueAfterDays !== null && s.dueAfterDays !== undefined) ? s.dueAfterDays : (s.plan.dueAfterDays ?? undefined),
        dueAfterPercent: s.dueAfterPercent ? Number(s.dueAfterPercent) : (s.plan.dueAfterPercent ? Number(s.plan.dueAfterPercent) : undefined),
      });

      // Matches scan access rule for PAYMENT_OVERDUE: active, not frozen, currently between start and end dates
      const isSubOverdue =
        s.status === "SUSPENDED_UNPAID" ||
        (overdueVal && s.status === "ACTIVE" && now >= s.startDate && now <= s.endDate && !isFrozen);

      const invoiceDetail = s.invoiceItem?.invoice
        ? {
            id: s.invoiceItem.invoice.id,
            gymId: s.invoiceItem.invoice.gymId,
            number: s.invoiceItem.invoice.number,
            memberId: s.invoiceItem.invoice.memberId,
            status: s.invoiceItem.invoice.status,
            subtotal: decimalToPiasters(s.invoiceItem.invoice.subtotal),
            discount: decimalToPiasters(s.invoiceItem.invoice.discount),
            total: decimalToPiasters(s.invoiceItem.invoice.total),
            note: s.invoiceItem.invoice.note,
            createdById: s.invoiceItem.invoice.createdById,
            shiftId: s.invoiceItem.invoice.shiftId,
            createdAt: s.invoiceItem.invoice.createdAt.toISOString(),
            items: (s.invoiceItem.invoice.items || []).map((i) => ({
              id: i.id,
              invoiceId: i.invoiceId,
              kind: i.kind,
              description: i.description,
              quantity: i.quantity,
              unitPrice: decimalToPiasters(i.unitPrice),
              total: decimalToPiasters(i.total),
              planId: i.planId,
              serviceId: i.serviceId,
              productId: i.productId,
            })),
            payments: (s.invoiceItem.invoice.payments || []).map((p) => ({
              id: p.id,
              invoiceId: p.invoiceId,
              method: p.method,
              amount: decimalToPiasters(p.amount),
              reference: p.reference,
              createdAt: p.createdAt.toISOString(),
            })),
            collectedAmount: collected,
            remainingAmount: remaining,
          }
        : null;

      return {
        id: s.id,
        gymId: s.gymId,
        memberId: s.memberId,
        member: s.member,
        planId: s.planId,
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
        freezeMaxCount: s.freezeMaxCount,
        freezeMaxTotalDays: s.freezeMaxTotalDays,
        freezeUsedCount: s.freezeUsedCount,
        freezeUsedDays: s.freezeUsedDays,
        activeCoach: s.assignments[0]?.coach || null,
        currentCoach: s.assignments[0]?.coach || null,
        freezes: s.freezes,
        isOverdue: isSubOverdue,
        isFrozen,
        invoice: invoiceDetail,
        createdAt: s.createdAt.toISOString(),
      };
    });

    // Summary statistics calculated across all items for this gym/filter
    const totalActive = mapped.filter((s) => s.status === "ACTIVE").length;
    const totalExpiringSoon = mapped.filter(
      (s) => s.status === "ACTIVE" && s.daysLeft <= 7 && s.daysLeft >= 0
    ).length;
    const totalOverdueAmount = mapped
      .filter((s) => s.isOverdue)
      .reduce((sum, s) => sum + s.remaining, 0);
    const totalPendingPayment = mapped.filter((s) => s.status === "PENDING_PAYMENT").length;

    // Filter memory criteria: expiringInDays, overdue
    let filtered = mapped;
    if (filters.expiringInDays !== undefined) {
      filtered = filtered.filter(
        (s) => s.status === "ACTIVE" && s.daysLeft <= filters.expiringInDays && s.daysLeft >= 0
      );
    }
    if (filters.overdue) {
      filtered = filtered.filter((s) => s.isOverdue);
    }

    if (filters.page !== undefined) {
      const pageNum = Math.max(1, filters.page || 1);
      const limitNum = Math.max(1, Math.min(100, filters.limit || 20));
      const total = filtered.length;
      const paginatedItems = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      return {
        items: paginatedItems,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        summary: {
          totalActive,
          totalExpiringSoon,
          totalOverdueAmount,
          totalPendingPayment,
        },
      };
    }

    return filtered;
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
      status: "ACTIVE",
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

  async previewCoachTransfer(gymId: string, id: string, dto: { newCoachId?: string; effectiveAt?: string }) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, gymId },
      include: {
        assignments: { where: { toDate: null } },
      },
    });

    if (!sub || sub.kind !== "PT") {
      return { milestones: [] };
    }

    const currentAssignment = sub.assignments[0];
    if (!currentAssignment) {
      return { milestones: [] };
    }

    const entries = await this.prisma.commissionEntry.findMany({
      where: {
        subscriptionId: sub.id,
        coachId: currentAssignment.coachId,
        payrollRunId: null,
        status: { not: "VOID" as any },
      },
      orderBy: { milestoneIndex: "asc" },
    });

    const transferAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();

    const heldMilestones: HeldMilestone[] = entries.map((e: any) => ({
      index: e.milestoneIndex,
      periodStart: new Date(e.periodStart),
      dueDate: new Date(e.dueDate),
      heldBps: e.shareBps,
    }));

    const splits = splitOnTransfer(heldMilestones, transferAt);

    const milestones = splits.map((s) => {
      const entry = entries.find((e: any) => e.milestoneIndex === s.index);
      return {
        index: s.index,
        periodStart: entry?.periodStart ? new Date(entry.periodStart).toISOString() : new Date().toISOString(),
        dueDate: entry?.dueDate ? new Date(entry.dueDate).toISOString() : new Date().toISOString(),
        base: entry ? decimalToPiasters(entry.baseAmount) : 0,
        oldCoachPercent: Math.round(s.oldKeepsBps / 100),
        oldCoachShareBps: s.oldKeepsBps,
        newCoachPercent: Math.round(s.newGetsBps / 100),
        newCoachShareBps: s.newGetsBps,
      };
    });

    return { milestones };
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

      const totalPiasters = decimalToPiasters(sub.price);
      let collectedPiasters = 0;

      if (sub.invoiceItem) {
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
        dueAfterDays: (sub.dueAfterDays !== null && sub.dueAfterDays !== undefined) ? sub.dueAfterDays : (sub.plan.dueAfterDays ?? undefined),
        dueAfterPercent: sub.dueAfterPercent ? Number(sub.dueAfterPercent) : (sub.plan.dueAfterPercent ? Number(sub.plan.dueAfterPercent) : undefined),
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

  async renew(
    gymId: string,
    actorId: string,
    actorRole: string,
    subscriptionId: string,
    dto: {
      planId?: string;
      coachId?: string;
      payments?: { method: "CASH" | "CARD" | "INSTAPAY" | "WALLET"; amount: number; reference?: string | null }[];
      notes?: string;
    }
  ) {
    const existing = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, gymId },
      include: {
        plan: true,
        member: true,
        assignments: { where: { toDate: null } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Subscription not found",
      });
    }

    if (existing.status === "CANCELLED") {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "SUBSCRIPTION_CANCELLED",
        message: "Cannot renew a cancelled subscription",
      });
    }

    const targetPlanId = dto.planId || existing.planId;
    const plan = await this.prisma.plan.findFirst({
      where: { id: targetPlanId, gymId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException({
        statusCode: 404,
        code: "PLAN_NOT_FOUND",
        message: "Plan not found or inactive",
      });
    }

    // Chaining rule: If existing.endDate > now, chain immediately from that date, otherwise start now
    const now = new Date();
    const startDate = existing.endDate > now ? existing.endDate.toISOString() : now.toISOString();

    const planPrice = decimalToPiasters(plan.price);
    const payments = dto.payments?.length
      ? dto.payments
      : [{ method: "CASH" as const, amount: planPrice }];

    const invoice = await this.invoicesService.create(
      gymId,
      actorId,
      actorRole,
      {
        memberId: existing.memberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: plan.id,
            quantity: 1,
            subscription: {
              startDate,
              coachId: dto.coachId || existing.assignments[0]?.coachId || undefined,
            },
          },
        ],
        payments,
        useWallet: false,
        note: dto.notes || `تجديد اشتراك #${existing.id.slice(0, 8)}`,
      }
    );

    const renewedSub = await this.prisma.subscription.findFirst({
      where: {
        gymId,
        memberId: existing.memberId,
        planId: plan.id,
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    return {
      message: "Subscription renewed successfully",
      invoice,
      subscription: renewedSub,
    };
  }
}
