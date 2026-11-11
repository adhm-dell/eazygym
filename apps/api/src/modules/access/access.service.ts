import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { evaluateAccess, evaluateSubscription, type AccessDecision } from "@gym/domain";

interface DebounceEntry {
  timestamp: number;
  response: any;
}

@Injectable()
export class AccessService {
  private readonly debounceMap = new Map<string, DebounceEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService
  ) {}

  async scan(
    gymId: string,
    actorId: string,
    query: string,
    customNow?: Date,
    selectedSubscriptionId?: string
  ) {
    const now = customNow || new Date();

    // 1. Resolve member (by code, prefix, phone, or id)
    const member = await this.prisma.member.findFirst({
      where: {
        gymId,
        OR: [
          { code: query },
          { code: { startsWith: query } },
          { phone: query },
          { phone: { endsWith: query } },
          { id: query },
        ],
      },
      include: {
        wallet: true,
        invoices: {
          where: { status: "OPEN" },
          include: {
            payments: true,
          },
        },
      },
    });

    if (!member) {
      await this.prisma.accessLog.create({
        data: {
          gymId,
          memberId: null,
          subscriptionId: null,
          allowed: false,
          reason: "MEMBER_NOT_FOUND",
          scannedAt: now,
          scannedById: actorId,
        },
      });

      throw new NotFoundException({
        statusCode: 404,
        code: "MEMBER_NOT_FOUND",
        message: `Member '${query}' not found`,
      });
    }

    // 2. Debounce check (bypassed if explicit subscriptionId selected)
    const debounceKey = `${gymId}_${member.id}`;
    const cached = this.debounceMap.get(debounceKey);
    if (!selectedSubscriptionId && cached && now.getTime() - cached.timestamp < 10000) {
      return {
        ...cached.response,
        duplicate: true,
      };
    }

    // Calculate member finances
    let remainingDebt = 0;
    if (member.invoices) {
      for (const inv of member.invoices) {
        const totalPiasters = Math.round(Number(inv.total) * 100);
        const paidPiasters = inv.payments.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
        remainingDebt += Math.max(0, totalPiasters - paidPiasters);
      }
    }
    const walletBalance = member.wallet?.balance ?? 0;

    // 3. Load gym settings
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    const timeZone = gym?.timezone || "Africa/Cairo";
    const classEntryMode = (gym?.classEntryMode as any) || "RECEPTION_STARTS";
    const classEarlyMinutes = gym?.classCheckinEarlyMinutes ?? 15;
    const expiringSoonDays = 7;

    const accessOpts = {
      timeZone,
      classEntryMode,
      classEarlyMinutes,
      expiringSoonDays,
    };

    // 4. Build access input & evaluate all subscriptions
    const accessSubs = await this.subscriptionsService.buildAccessInput(
      gymId,
      member.id,
      now
    );

    const allMemberSubs = await this.prisma.subscription.findMany({
      where: { memberId: member.id, gymId },
      include: {
        plan: true,
        classSlots: {
          include: {
            classSchedule: {
              include: { coach: true },
            },
          },
        },
        assignments: {
          where: { toDate: null },
          include: { coach: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const evaluatedSubs = accessSubs.map((s) => ({
      s,
      status: evaluateSubscription(s, now, accessOpts),
    }));

    const activeList = evaluatedSubs.filter((e) => e.status === "ACTIVE");

    const activeSubsSummary = activeList.map((item) => {
      const subRow = allMemberSubs.find((s) => s.id === item.s.id);
      const classSlot = subRow?.classSlots[0]?.classSchedule;
      const coach = subRow?.assignments[0]?.coach || classSlot?.coach;
      const daysLeft = Math.max(0, Math.ceil((item.s.endDate.getTime() - now.getTime()) / 86_400_000));
      return {
        id: item.s.id,
        kind: item.s.kind,
        planName: subRow?.plan?.name || item.s.kind,
        daysLeft,
        sessionsLeft: item.s.sessionsLeft,
        totalSessions: subRow?.totalSessions,
        usedSessions: subRow?.usedSessions,
        className: classSlot?.name,
        classTime: classSlot ? `${classSlot.startTime} - ${classSlot.endTime}` : undefined,
        coachName: coach?.name,
      };
    });

    // If specific subscription selected by receptionist
    let subsToEvaluate = accessSubs;
    if (selectedSubscriptionId) {
      const target = accessSubs.filter((s) => s.id === selectedSubscriptionId);
      if (target.length > 0) {
        subsToEvaluate = target;
      }
    }

    const decision: AccessDecision = evaluateAccess(
      {
        isBlocked: member.isBlocked,
        subscriptions: subsToEvaluate,
      },
      now,
      accessOpts
    );

    // 5. Decrement session if GYM subscription has session limit
    let activeSubRow = decision.subscriptionId
      ? allMemberSubs.find((s) => s.id === decision.subscriptionId)
      : null;

    if (!activeSubRow && decision.subscriptionId) {
      activeSubRow = await this.prisma.subscription.findUnique({
        where: { id: decision.subscriptionId },
        include: {
          plan: true,
          classSlots: {
            include: {
              classSchedule: {
                include: { coach: true },
              },
            },
          },
          assignments: {
            where: { toDate: null },
            include: { coach: true },
          },
        },
      });
    }

    if (
      decision.allowed &&
      activeSubRow &&
      activeSubRow.kind === "GYM" &&
      activeSubRow.totalSessions !== null
    ) {
      await this.prisma.subscription.update({
        where: { id: activeSubRow.id },
        data: { usedSessions: activeSubRow.usedSessions + 1 },
      });
    }

    // 6. Write AccessLog
    await this.prisma.accessLog.create({
      data: {
        gymId,
        memberId: member.id,
        subscriptionId: decision.subscriptionId || null,
        allowed: decision.allowed,
        reason: decision.reason,
        scannedAt: now,
        scannedById: actorId,
      },
    });

    // 7. Resolve nextAction
    let nextAction: "SELL" | "COLLECT_BALANCE" | "UNFREEZE" | "RENEW" | "START_CLASS" | "NONE" = "NONE";
    if (decision.allowed) {
      nextAction = decision.expiringSoon ? "RENEW" : "NONE";
    } else {
      switch (decision.reason) {
        case "FROZEN":
          nextAction = "UNFREEZE";
          break;
        case "PAYMENT_OVERDUE":
        case "PENDING_PAYMENT":
          nextAction = "COLLECT_BALANCE";
          break;
        case "NO_SUBSCRIPTION":
        case "EXPIRED":
        case "PT_EXPIRED":
        case "NO_SESSIONS_LEFT":
          nextAction = "SELL";
          break;
        case "CLASS_NOT_STARTED":
          nextAction = "START_CLASS";
          break;
        default:
          nextAction = "NONE";
      }
    }

    const chosenClassSlot = activeSubRow?.classSlots[0]?.classSchedule;
    const chosenCoach = activeSubRow?.assignments[0]?.coach || chosenClassSlot?.coach;
    const sessionsLeft =
      activeSubRow?.totalSessions !== null && activeSubRow?.totalSessions !== undefined
        ? Math.max(0, activeSubRow.totalSessions - activeSubRow.usedSessions)
        : null;

    const response = {
      allowed: decision.allowed,
      reason: decision.reason,
      member: {
        id: member.id,
        code: member.code,
        name: member.name,
        phone: member.phone,
        photoUrl: null,
        isBlocked: member.isBlocked,
        blockedReason: member.blockedReason,
        remainingDebt,
        walletBalance,
      },
      subscription: activeSubRow
        ? {
            id: activeSubRow.id,
            kind: activeSubRow.kind,
            planName: activeSubRow.plan.name,
            startDate: activeSubRow.startDate.toISOString(),
            endDate: activeSubRow.endDate.toISOString(),
            daysLeft: decision.daysLeft,
            sessionsLeft,
            totalSessions: activeSubRow.totalSessions,
            usedSessions: activeSubRow.usedSessions,
            coachName: chosenCoach?.name,
            className: chosenClassSlot?.name,
            classTime: chosenClassSlot ? `${chosenClassSlot.startTime} - ${chosenClassSlot.endTime}` : undefined,
          }
        : undefined,
      planName: activeSubRow?.plan?.name,
      planKind: activeSubRow?.kind,
      daysLeft: decision.daysLeft,
      sessionsLeft,
      totalSessions: activeSubRow?.totalSessions,
      coachName: chosenCoach?.name,
      className: chosenClassSlot?.name,
      classTime: chosenClassSlot ? `${chosenClassSlot.startTime} - ${chosenClassSlot.endTime}` : undefined,
      expiringSoon: decision.expiringSoon ?? false,
      nextAction,
      hasMultipleSubscriptions: activeSubsSummary.length > 1,
      activeSubscriptions: activeSubsSummary,
    };

    this.debounceMap.set(debounceKey, {
      timestamp: now.getTime(),
      response,
    });

    return response;
  }

  async getRecentLogs(gymId: string, limit = 20) {
    const logs = await this.prisma.accessLog.findMany({
      where: { gymId },
      include: {
        member: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { scannedAt: "desc" },
      take: limit,
    });

    const subIds = logs.map((l) => l.subscriptionId).filter(Boolean) as string[];
    const subs = subIds.length > 0
      ? await this.prisma.subscription.findMany({
          where: { id: { in: subIds } },
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        })
      : [];

    const subMap = new Map(subs.map((s) => [s.id, s]));

    return logs.map((log) => {
      const sub = log.subscriptionId ? subMap.get(log.subscriptionId) : null;
      return {
        ...log,
        memberName: log.member?.name || (log as any).memberName || null,
        memberCode: log.member?.code || null,
        memberPhone: log.member?.phone || null,
        planName: sub?.plan?.name || (log as any).planName || null,
        planKind: sub?.kind || null,
      };
    });
  }
}
