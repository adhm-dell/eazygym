import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  RequestCoachBreakDto,
  RejectCoachBreakDto,
  NotifyBreakReturnDto,
} from "@gym/contracts";
import {
  canRequestBreak,
  canApproveBreak,
  initialBreakStatus,
  countsTowardDailyLimit,
  isBreakOverdue,
  shouldNotifyOverdue,
  isOnShift,
  type BreakRequesterRole,
  type BreakStatus,
  type CoachShiftRow,
} from "@gym/domain";

@Injectable()
export class CoachBreaksService {
  constructor(private readonly prisma: PrismaService) {}

  private async getGymSettings(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        id: true,
        timezone: true,
        maxCoachBreaksPerDay: true,
        coachBreakDurationMinutes: true,
      },
    });
    return {
      timezone: gym?.timezone || "Africa/Cairo",
      maxPerDay: gym?.maxCoachBreaksPerDay ?? 2,
      durationMinutes: gym?.coachBreakDurationMinutes ?? 30,
    };
  }

  async getBreaks(gymId: string, coachId?: string) {
    const where: any = { gymId };
    if (coachId) where.coachId = coachId;

    const [breaks, activeBreak] = await Promise.all([
      this.prisma.coachBreak.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: 50,
      }),
      this.prisma.coachBreak.findFirst({
        where: { gymId, status: "ACTIVE" },
      }),
    ]);

    return {
      breaks,
      activeBreak,
    };
  }

  async requestBreak(
    gymId: string,
    requester: { id: string; role: string },
    dto: RequestCoachBreakDto,
    overrideNow?: Date
  ) {
    const now = overrideNow || new Date();
    const settings = await this.getGymSettings(gymId);

    // 1. Fetch coach shifts & check if on shift
    const shifts = await this.prisma.coachShift.findMany({
      where: { gymId, coachId: dto.coachId, isActive: true },
    });
    const shiftRows: CoachShiftRow[] = shifts.map((s) => ({
      coachId: s.coachId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    }));
    const coachOnShift = isOnShift(shiftRows, now, settings.timezone);

    // 2. Check active breaks
    const activeBreaks = await this.prisma.coachBreak.findMany({
      where: { gymId, status: "ACTIVE" },
    });
    const coachHasActiveBreak = activeBreaks.some((b) => b.coachId === dto.coachId);
    const anotherCoachActiveBreak = activeBreaks.some((b) => b.coachId !== dto.coachId);

    // 3. Count today's breaks for coach
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayBreaks = await this.prisma.coachBreak.findMany({
      where: {
        gymId,
        coachId: dto.coachId,
        requestedAt: { gte: startOfToday },
      },
    });
    const breaksTodayCounted = todayBreaks.filter((b) =>
      countsTowardDailyLimit(b.status as BreakStatus)
    ).length;

    // 4. Validate with domain logic
    const requesterRole = requester.role as BreakRequesterRole;
    const denial = canRequestBreak({
      requesterRole,
      requesterId: requester.id,
      coachId: dto.coachId,
      coachOnShift,
      coachHasActiveBreak,
      anotherCoachActiveBreak,
      breaksTodayCounted,
      maxPerDay: settings.maxPerDay,
    });

    if (denial !== "OK") {
      if (denial === "COACH_CAN_ONLY_REQUEST_FOR_SELF") {
        throw new ForbiddenException(denial);
      }
      throw new BadRequestException(denial);
    }

    const status = initialBreakStatus(requesterRole);
    const startedAt = status === "ACTIVE" ? now : null;

    const record = await this.prisma.coachBreak.create({
      data: {
        gymId,
        coachId: dto.coachId,
        status,
        reason: dto.reason || null,
        requestedById: requester.id,
        requestedAt: now,
        startedAt,
      },
    });

    // Notify if PENDING
    if (status === "PENDING") {
      await this.prisma.notification.create({
        data: {
          gymId,
          recipientType: "ADMIN_BROADCAST",
          recipientId: gymId,
          type: "BREAK_REQUESTED",
          title: "طلب استراحة مدرب",
          body: `المدرب طلب استراحة: ${dto.reason || "بدون سبب"}`,
          dedupeKey: `break-req:${record.id}`,
        },
      });
    }

    return record;
  }

  async approveBreak(gymId: string, breakId: string, actorId: string, overrideNow?: Date) {
    const now = overrideNow || new Date();

    return this.prisma.$transaction(async (tx) => {
      const b = await tx.coachBreak.findFirst({
        where: { id: breakId, gymId },
      });
      if (!b) throw new NotFoundException("Break not found");

      const anotherActive = await tx.coachBreak.findFirst({
        where: { gymId, status: "ACTIVE", id: { not: breakId } },
      });

      const check = canApproveBreak({
        status: b.status as BreakStatus,
        anotherCoachActiveBreak: !!anotherActive,
      });

      if (check !== "OK") {
        throw new BadRequestException(check);
      }

      const updated = await tx.coachBreak.update({
        where: { id: breakId },
        data: {
          status: "ACTIVE",
          startedAt: now,
        },
      });

      await tx.notification.create({
        data: {
          gymId,
          recipientType: "STAFF",
          recipientId: b.coachId,
          type: "BREAK_APPROVED",
          title: "تمت الموافقة على الاستراحة",
          body: "تمت الموافقة على طلب الاستراحة الخاص بك",
          dedupeKey: `break-app:${breakId}`,
        },
      });

      return updated;
    });
  }

  async rejectBreak(gymId: string, breakId: string, actorId: string, dto: RejectCoachBreakDto) {
    const b = await this.prisma.coachBreak.findFirst({
      where: { id: breakId, gymId },
    });
    if (!b) throw new NotFoundException("Break not found");
    if (b.status !== "PENDING") {
      throw new BadRequestException("NOT_PENDING");
    }

    const updated = await this.prisma.coachBreak.update({
      where: { id: breakId },
      data: {
        status: "REJECTED",
        rejectionReason: dto.reason,
      },
    });

    await this.prisma.notification.create({
      data: {
        gymId,
        recipientType: "STAFF",
        recipientId: b.coachId,
        type: "BREAK_REJECTED",
        title: "تم رفض طلب الاستراحة",
        body: `تم رفض الاستراحة للسبب التالي: ${dto.reason}`,
        dedupeKey: `break-rej:${breakId}`,
      },
    });

    return updated;
  }

  async endBreak(gymId: string, breakId: string, actor: { id: string; role: string }, overrideNow?: Date) {
    const now = overrideNow || new Date();

    const b = await this.prisma.coachBreak.findFirst({
      where: { id: breakId, gymId },
    });
    if (!b) throw new NotFoundException("Break not found");
    if (b.status !== "ACTIVE") {
      throw new BadRequestException("NOT_ACTIVE");
    }
    if (actor.role === "COACH" && actor.id !== b.coachId) {
      throw new ForbiddenException("Cannot end another coach's break");
    }

    return this.prisma.coachBreak.update({
      where: { id: breakId },
      data: {
        status: "COMPLETED",
        endedAt: now,
        endedById: actor.id,
      },
    });
  }

  async notifyReturn(gymId: string, dto: NotifyBreakReturnDto) {
    return this.prisma.notification.create({
      data: {
        gymId,
        recipientType: "STAFF",
        recipientId: dto.coachId,
        type: "BREAK_INTERRUPT",
        title: "برجاء العودة للاستقبال",
        body: "برجاء قطع الاستراحة والعودة إلى منطقة الاستقبال فوراً",
        dedupeKey: `break-int:${dto.coachId}:${Date.now()}`,
      },
    });
  }

  async checkOverdueBreaks(gymId: string, overrideNow?: Date) {
    const now = overrideNow || new Date();
    const settings = await this.getGymSettings(gymId);

    const activeBreaks = await this.prisma.coachBreak.findMany({
      where: { gymId, status: "ACTIVE" },
    });

    const notified: string[] = [];

    for (const b of activeBreaks) {
      if (!b.startedAt) continue;
      const overdue = isBreakOverdue({
        startedAt: b.startedAt,
        now,
        maxMinutes: settings.durationMinutes,
      });

      if (overdue && shouldNotifyOverdue({ lastNotifiedAt: b.lastOverdueNotifiedAt, now })) {
        await this.prisma.notification.createMany({
          data: [
            {
              gymId,
              recipientType: "STAFF",
              recipientId: b.coachId,
              type: "BREAK_EXCEEDED",
              title: "تجاوز مدة الاستراحة",
              body: `لقد تجاوزت الحد الأقصى للاستراحة (${settings.durationMinutes} دقيقة)`,
              dedupeKey: `break-exc-coach:${b.id}:${now.getTime()}`,
            },
            {
              gymId,
              recipientType: "ADMIN_BROADCAST",
              recipientId: gymId,
              type: "BREAK_EXCEEDED",
              title: "مدرب تجاوز مدة الاستراحة",
              body: `تجاوز مدرب وقت الاستراحة المحدد`,
              dedupeKey: `break-exc-admin:${b.id}:${now.getTime()}`,
            },
          ],
        });

        await this.prisma.coachBreak.update({
          where: { id: b.id },
          data: { lastOverdueNotifiedAt: now },
        });

        notified.push(b.id);
      }
    }

    return { notifiedBreakIds: notified };
  }
}

