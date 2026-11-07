import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { evaluateAccess, type AccessDecision } from "@gym/domain";

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
    customNow?: Date
  ) {
    const now = customNow || new Date();

    // 1. Resolve member (by code, phone, or id)
    const member = await this.prisma.member.findFirst({
      where: {
        gymId,
        OR: [{ code: query }, { phone: query }, { id: query }],
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

    // 2. 10-second debounce check
    const debounceKey = `${gymId}_${member.id}`;
    const cached = this.debounceMap.get(debounceKey);
    if (cached && now.getTime() - cached.timestamp < 10000) {
      return {
        ...cached.response,
        duplicate: true,
      };
    }

    // 3. Load gym settings
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    const timeZone = gym?.timezone || "Africa/Cairo";
    const classEntryMode = gym?.classEntryMode as any || "RECEPTION_STARTS";
    const classEarlyMinutes = gym?.classCheckinEarlyMinutes ?? 15;
    const expiringSoonDays = 7;

    // 4. Build access input & evaluate
    const accessSubs = await this.subscriptionsService.buildAccessInput(
      gymId,
      member.id,
      now
    );

    const decision: AccessDecision = evaluateAccess(
      {
        isBlocked: member.isBlocked,
        subscriptions: accessSubs,
      },
      now,
      {
        timeZone,
        classEntryMode,
        classEarlyMinutes,
        expiringSoonDays,
      }
    );

    // 5. Decrement session if GYM subscription has session limit
    let activeSubRow: any = null;
    if (decision.subscriptionId) {
      activeSubRow = await this.prisma.subscription.findUnique({
        where: { id: decision.subscriptionId },
        include: { plan: true },
      });

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
      },
      subscription: activeSubRow
        ? {
            id: activeSubRow.id,
            kind: activeSubRow.kind,
            planName: activeSubRow.plan.name,
            endDate: activeSubRow.endDate.toISOString(),
            daysLeft: decision.daysLeft,
          }
        : undefined,
      expiringSoon: decision.expiringSoon ?? false,
      nextAction,
    };

    this.debounceMap.set(debounceKey, {
      timestamp: now.getTime(),
      response,
    });

    return response;
  }

  async getRecentLogs(gymId: string, limit = 20) {
    return this.prisma.accessLog.findMany({
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
  }
}
