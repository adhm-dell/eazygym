import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateCoachSessionDto,
  AddSessionParticipantDto,
  RecordSessionAttendanceDto,
} from "@gym/contracts";
import {
  canAddParticipant,
  consumptionOnAttendance,
  type SessionSourceKind,
} from "@gym/domain";

@Injectable()
export class CoachSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrainees(gymId: string, coachId: string) {
    const trainees = await this.prisma.coachTrainee.findMany({
      where: { gymId, coachId, isActive: true },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            code: true,
            invoices: {
              where: { status: "OPEN" },
              select: { id: true, total: true },
            },
            subscriptions: {
              where: {
                status: "ACTIVE",
                plan: { kind: "PT" },
                assignments: {
                  some: { coachId, toDate: null },
                },
              },
              select: {
                id: true,
                status: true,
                totalSessions: true,
                usedSessions: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    const now = new Date();

    return trainees.map((t) => {
      const activePtSub = t.member.subscriptions[0];
      const sessionsLeft =
        activePtSub && activePtSub.totalSessions != null
          ? Math.max(0, activePtSub.totalSessions - activePtSub.usedSessions)
          : null;

      const daysLeft = activePtSub
        ? Math.ceil(
            (new Date(activePtSub.endDate).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      const freeSessionsLeft = Math.max(0, t.freeSessionsGranted - t.freeSessionsUsed);
      const pendingBalance = t.member.invoices.length > 0;

      return {
        id: t.id,
        memberId: t.memberId,
        member: {
          id: t.member.id,
          name: t.member.name,
          phone: t.member.phone,
          code: t.member.code,
        },
        isActive: t.isActive,
        freeSessionsGranted: t.freeSessionsGranted,
        freeSessionsUsed: t.freeSessionsUsed,
        freeSessionsLeft,
        ptSubscription: activePtSub || null,
        sessionsLeft,
        daysLeft,
        pendingBalance,
      };
    });
  }

  async updateTrainee(gymId: string, traineeId: string, isActive: boolean) {
    const trainee = await this.prisma.coachTrainee.findFirst({
      where: { id: traineeId, gymId },
    });
    if (!trainee) throw new NotFoundException("Trainee not found");

    return this.prisma.coachTrainee.update({
      where: { id: traineeId },
      data: { isActive },
    });
  }

  async createSession(gymId: string, dto: CreateCoachSessionDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException("Session start time must be before end time");
    }

    // Check overlapping session for this coach
    const overlapping = await this.prisma.coachSession.findFirst({
      where: {
        gymId,
        coachId: dto.coachId,
        status: "SCHEDULED",
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException("OVERLAPPING_SESSION");
    }

    return this.prisma.coachSession.create({
      data: {
        gymId,
        coachId: dto.coachId,
        type: dto.type,
        status: "SCHEDULED",
        startTime,
        endTime,
        capacity: dto.type === "GROUP" ? dto.capacity || 20 : null,
        classScheduleId: dto.classScheduleId || null,
        notes: dto.notes || null,
      },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        participants: true,
      },
    });
  }

  async addParticipant(gymId: string, sessionId: string, dto: AddSessionParticipantDto) {
    const session = await this.prisma.coachSession.findFirst({
      where: { id: sessionId, gymId },
      include: { participants: true },
    });

    if (!session) throw new NotFoundException("Session not found");
    if (session.status !== "SCHEDULED") {
      throw new BadRequestException("SESSION_NOT_SCHEDULED");
    }

    const alreadyIn = session.participants.some((p) => p.memberId === dto.memberId);
    let hasSubscription = false;
    let ptSessionsLeft: number | null = null;
    let freeSessionsLeft = 0;

    if (dto.source === "PT_LINKED") {
      const ptSub = await this.prisma.subscription.findFirst({
        where: {
          id: dto.subscriptionId || undefined,
          gymId,
          memberId: dto.memberId,
          status: "ACTIVE",
          plan: { kind: "PT" },
          assignments: {
            some: { coachId: session.coachId, toDate: null },
          },
        },
      });
      if (ptSub) {
        hasSubscription = true;
        ptSessionsLeft =
          ptSub.totalSessions != null
            ? Math.max(0, ptSub.totalSessions - ptSub.usedSessions)
            : null;
      }
    } else if (dto.source === "CLASS_LINKED") {
      const classSub = await this.prisma.subscription.findFirst({
        where: {
          gymId,
          memberId: dto.memberId,
          status: "ACTIVE",
          plan: { kind: "CLASS" },
        },
      });
      hasSubscription = !!classSub;
    } else if (dto.source === "FREE_GRANT") {
      const trainee = await this.prisma.coachTrainee.findFirst({
        where: {
          gymId,
          coachId: session.coachId,
          memberId: dto.memberId,
          isActive: true,
        },
      });
      if (trainee) {
        freeSessionsLeft = Math.max(0, trainee.freeSessionsGranted - trainee.freeSessionsUsed);
      }
    }

    const check = canAddParticipant({
      source: dto.source as SessionSourceKind,
      alreadyIn,
      capacity: session.capacity,
      participantsCount: session.participants.length,
      hasSubscription,
      ptSessionsLeft,
      freeSessionsLeft,
    });

    if (check !== "OK") {
      throw new BadRequestException(check);
    }

    return this.prisma.sessionParticipant.create({
      data: {
        sessionId,
        memberId: dto.memberId,
        source: dto.source,
        subscriptionId: dto.subscriptionId || null,
        attended: false,
      },
      include: {
        member: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async recordAttendance(
    gymId: string,
    sessionId: string,
    dto: RecordSessionAttendanceDto
  ) {
    const session = await this.prisma.coachSession.findFirst({
      where: { id: sessionId, gymId },
      include: { participants: true },
    });

    if (!session) throw new NotFoundException("Session not found");

    const participantsInput = session.participants.map((p) => ({
      memberId: p.memberId,
      source: p.source as SessionSourceKind,
      subscriptionId: p.subscriptionId,
      attended: p.attended,
    }));

    const { ptDeductions, freeDeductions } = consumptionOnAttendance(
      participantsInput,
      dto.attendedMemberIds
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct PT sessions
      for (const d of ptDeductions) {
        await tx.subscription.update({
          where: { id: d.subscriptionId },
          data: {
            usedSessions: { increment: d.count },
          },
        });
      }

      // 2. Deduct Free sessions
      for (const d of freeDeductions) {
        await tx.coachTrainee.updateMany({
          where: {
            gymId,
            coachId: session.coachId,
            memberId: d.memberId,
          },
          data: {
            freeSessionsUsed: { increment: d.count },
          },
        });
      }

      // 3. Mark attended participants
      if (dto.attendedMemberIds.length > 0) {
        await tx.sessionParticipant.updateMany({
          where: {
            sessionId,
            memberId: { in: dto.attendedMemberIds },
          },
          data: { attended: true },
        });
      }

      // 4. Mark session COMPLETED
      const updated = await tx.coachSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED" },
        include: { participants: true },
      });

      return {
        session: updated,
        ptDeductionsCount: ptDeductions.reduce((s, x) => s + x.count, 0),
        freeDeductionsCount: freeDeductions.reduce((s, x) => s + x.count, 0),
      };
    });
  }

  async recordNoShow(gymId: string, sessionId: string) {
    const session = await this.prisma.coachSession.findFirst({
      where: { id: sessionId, gymId },
    });
    if (!session) throw new NotFoundException("Session not found");

    return this.prisma.coachSession.update({
      where: { id: sessionId },
      data: { status: "NO_SHOW" },
      include: { participants: true },
    });
  }

  async cancelSession(gymId: string, sessionId: string) {
    const session = await this.prisma.coachSession.findFirst({
      where: { id: sessionId, gymId },
      include: { participants: true },
    });
    if (!session) throw new NotFoundException("Session not found");

    const updated = await this.prisma.coachSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" },
    });

    for (const p of session.participants) {
      await this.prisma.notification.create({
        data: {
          gymId,
          recipientType: "MEMBER",
          recipientId: p.memberId,
          type: "SESSION_CANCELLED",
          title: "إلغاء جلسة التدريب",
          body: "تم إلغاء جلسة التدريب المحددة مسبقاً",
          dedupeKey: `sess-cancel:${sessionId}:${p.memberId}`,
        },
      });
    }

    return updated;
  }

  async getSessions(
    gymId: string,
    query: { coachId?: string; fromDate?: string; toDate?: string }
  ) {
    const where: any = { gymId };
    if (query.coachId) where.coachId = query.coachId;
    if (query.fromDate || query.toDate) {
      where.startTime = {};
      if (query.fromDate) where.startTime.gte = new Date(query.fromDate);
      if (query.toDate) where.startTime.lte = new Date(query.toDate);
    }

    return this.prisma.coachSession.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        participants: {
          include: {
            member: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
  }
}
