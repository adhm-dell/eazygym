import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { canStartClass, localParts } from "@gym/domain";
import type {
  CreateClassScheduleDto,
  UpdateClassScheduleDto,
  CreateClassExceptionDto,
  StartClassDto,
} from "@gym/contracts";

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listSchedules(gymId: string) {
    return this.prisma.classSchedule.findMany({
      where: { gymId, isActive: true },
      include: {
        coach: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async createSchedule(gymId: string, actorId: string, dto: CreateClassScheduleDto) {
    const coach = await this.prisma.staff.findFirst({
      where: { id: dto.coachId, gymId, isActive: true },
    });
    if (!coach) {
      throw new NotFoundException({
        statusCode: 404,
        code: "COACH_NOT_FOUND",
        message: `Coach ${dto.coachId} not found`,
      });
    }

    const schedule = await this.prisma.classSchedule.create({
      data: {
        gymId,
        name: dto.name,
        coachId: dto.coachId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.capacity,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "CLASS_SCHEDULE_CREATE",
      entityType: "ClassSchedule",
      entityId: schedule.id,
      after: schedule,
    });

    return schedule;
  }

  async updateSchedule(gymId: string, actorId: string, id: string, dto: UpdateClassScheduleDto) {
    const existing = await this.prisma.classSchedule.findFirst({
      where: { id, gymId },
    });
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "SCHEDULE_NOT_FOUND",
        message: `Schedule ${id} not found`,
      });
    }

    const updated = await this.prisma.classSchedule.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        coachId: dto.coachId ?? existing.coachId,
        dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
        startTime: dto.startTime ?? existing.startTime,
        endTime: dto.endTime ?? existing.endTime,
        capacity: dto.capacity ?? existing.capacity,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "CLASS_SCHEDULE_UPDATE",
      entityType: "ClassSchedule",
      entityId: id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async addException(gymId: string, actorId: string, scheduleId: string, dto: CreateClassExceptionDto) {
    const schedule = await this.prisma.classSchedule.findFirst({
      where: { id: scheduleId, gymId },
    });
    if (!schedule) {
      throw new NotFoundException({
        statusCode: 404,
        code: "SCHEDULE_NOT_FOUND",
        message: `Schedule ${scheduleId} not found`,
      });
    }

    const date = new Date(dto.date);
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const exception = await this.prisma.classScheduleException.upsert({
      where: {
        classScheduleId_date: {
          classScheduleId: scheduleId,
          date: dateOnly,
        },
      },
      update: {
        isCancelled: dto.isCancelled,
        newStartTime: dto.newStartTime,
        newEndTime: dto.newEndTime,
        substituteCoachId: dto.substituteCoachId,
      },
      create: {
        classScheduleId: scheduleId,
        date: dateOnly,
        isCancelled: dto.isCancelled,
        newStartTime: dto.newStartTime,
        newEndTime: dto.newEndTime,
        substituteCoachId: dto.substituteCoachId,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "CLASS_EXCEPTION_CREATE",
      entityType: "ClassScheduleException",
      entityId: exception.id,
      after: exception,
    });

    return exception;
  }

  async getTodayClasses(gymId: string, customNow?: Date) {
    const now = customNow || new Date();
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    const timeZone = gym?.timezone || "Africa/Cairo";

    const { dayOfWeek } = localParts(now, timeZone);
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const schedules = await this.prisma.classSchedule.findMany({
      where: {
        gymId,
        dayOfWeek,
        isActive: true,
      },
      include: {
        coach: { select: { id: true, name: true } },
        exceptions: { where: { date: todayDate } },
        sessions: { where: { date: todayDate } },
        slots: {
          include: {
            subscription: {
              include: {
                member: { select: { id: true, code: true, name: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return schedules.map((s) => {
      const ex = s.exceptions[0];
      const session = s.sessions[0];

      let status = "NOT_STARTED";
      if (ex?.isCancelled) {
        status = "CANCELLED";
      } else if (session) {
        status = session.endedAt ? "ENDED" : "RUNNING";
      }

      return {
        id: s.id,
        name: s.name,
        coach: s.coach,
        dayOfWeek: s.dayOfWeek,
        startTime: ex?.newStartTime || s.startTime,
        endTime: ex?.newEndTime || s.endTime,
        capacity: s.capacity,
        registeredCount: s.slots.length,
        status,
        session: session
          ? {
              id: session.id,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              actualCoachId: session.actualCoachId,
            }
          : null,
        members: s.slots.map((sl) => sl.subscription.member),
      };
    });
  }

  async startClass(gymId: string, actorId: string, scheduleId: string, dto?: StartClassDto, customNow?: Date) {
    const now = customNow || new Date();
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    const timeZone = gym?.timezone || "Africa/Cairo";

    const schedule = await this.prisma.classSchedule.findFirst({
      where: { id: scheduleId, gymId, isActive: true },
      include: {
        exceptions: true,
        sessions: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException({
        statusCode: 404,
        code: "SCHEDULE_NOT_FOUND",
        message: `Schedule ${scheduleId} not found or inactive`,
      });
    }

    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const exception = schedule.exceptions.find(
      (e) => e.date.getTime() === todayDate.getTime()
    );
    const existingSession = schedule.sessions.find(
      (s) => s.date.getTime() === todayDate.getTime()
    );

    const check = canStartClass({
      scheduleDayOfWeek: schedule.dayOfWeek,
      now,
      timeZone,
      cancelledToday: exception?.isCancelled ?? false,
      alreadyStarted: !!existingSession,
    });

    if (check !== "OK") {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: check,
        message: `Cannot start class: ${check}`,
      });
    }

    const session = await this.prisma.classSession.create({
      data: {
        gymId,
        classScheduleId: scheduleId,
        date: todayDate,
        startedAt: now,
        startedById: actorId,
        actualCoachId: dto?.actualCoachId || schedule.coachId,
        note: dto?.note || null,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "CLASS_SESSION_START",
      entityType: "ClassSession",
      entityId: session.id,
      after: session,
    });

    return session;
  }

  async endClass(gymId: string, actorId: string, scheduleId: string, customNow?: Date) {
    const now = customNow || new Date();
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const session = await this.prisma.classSession.findFirst({
      where: {
        classScheduleId: scheduleId,
        gymId,
        date: todayDate,
        endedAt: null,
      },
    });

    if (!session) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NOT_RUNNING",
        message: "No active running class session found to end",
      });
    }

    const updated = await this.prisma.classSession.update({
      where: { id: session.id },
      data: {
        endedAt: now,
        endedById: actorId,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "CLASS_SESSION_END",
      entityType: "ClassSession",
      entityId: session.id,
      after: updated,
    });

    return updated;
  }
}
