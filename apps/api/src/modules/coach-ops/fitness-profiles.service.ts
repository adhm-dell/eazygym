import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  UpdateFitnessProfileDto,
  CreateFitnessAssessmentDto,
  AssignFitnessProfileDto,
  RejectFitnessAssignmentDto,
  UpdateRotationQueueDto,
} from "@gym/contracts";
import {
  recommendCoach,
  moveToBack,
  isOnShift,
  type RotationCoach,
  type QueueEntry,
  type CoachShiftRow,
} from "@gym/domain";

@Injectable()
export class FitnessProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getGymSettings(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        id: true,
        timezone: true,
        freeSessionsOnFitnessProfile: true,
      },
    });
    return {
      timezone: gym?.timezone || "Africa/Cairo",
      freeSessions: gym?.freeSessionsOnFitnessProfile ?? 1,
    };
  }

  async createIfFirst(gymId: string, memberId: string, subscriptionId?: string) {
    let profile = await this.prisma.fitnessProfile.findUnique({
      where: { memberId },
    });

    if (profile) return profile;

    profile = await this.prisma.fitnessProfile.create({
      data: {
        gymId,
        memberId,
        createdBySubscriptionId: subscriptionId || null,
      },
    });

    await this.triggerRotation(gymId, profile.id);
    return profile;
  }

  async triggerRotation(gymId: string, profileId: string, overrideNow?: Date) {
    const now = overrideNow || new Date();
    const settings = await this.getGymSettings(gymId);

    // 1. Fetch active coaches
    const coaches = await this.prisma.staff.findMany({
      where: { gymId, role: "COACH", isActive: true },
    });

    if (coaches.length === 0) {
      await this.prisma.notification.create({
        data: {
          gymId,
          recipientType: "ADMIN_BROADCAST",
          recipientId: gymId,
          type: "NO_COACH_AVAILABLE",
          title: "لا يوجد مدرب متاح",
          body: "تعذر ترشيح مدرب للمشترك الجديد لعدم وجود مدربين مسجلين",
          dedupeKey: `no-coach:${profileId}:${now.getTime()}`,
        },
      });
      return { assigned: false, reason: "NO_COACH_AVAILABLE" };
    }

    // 2. Shifts & breaks
    const [allShifts, activeBreaks] = await Promise.all([
      this.prisma.coachShift.findMany({
        where: { gymId, isActive: true },
      }),
      this.prisma.coachBreak.findMany({
        where: { gymId, status: "ACTIVE" },
      }),
    ]);

    const activeBreakCoachIds = new Set(activeBreaks.map((b) => b.coachId));

    const rotationCoaches: RotationCoach[] = coaches.map((c) => {
      const coachShifts: CoachShiftRow[] = allShifts
        .filter((s) => s.coachId === c.id)
        .map((s) => ({
          coachId: s.coachId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        }));

      const onShift = isOnShift(coachShifts, now, settings.timezone);
      const onBreak = activeBreakCoachIds.has(c.id);

      return {
        id: c.id,
        isActive: c.isActive,
        onShift,
        onBreak,
      };
    });

    // 3. Rejected coaches for this profile
    const rejectedAssignments = await this.prisma.fitnessProfileAssignment.findMany({
      where: { profileId, status: "REJECTED" },
      select: { coachId: true },
    });
    const rejectedCoachIds = rejectedAssignments.map((a) => a.coachId);

    // 4. Queue
    const queueEntries = await this.prisma.coachRotationQueue.findMany({
      where: { gymId },
      orderBy: { position: "asc" },
    });
    const queue: QueueEntry[] = queueEntries.map((q) => ({
      coachId: q.coachId,
      position: q.position,
    }));

    // 5. Domain recommendation
    const recommendation = recommendCoach({
      coaches: rotationCoaches,
      queue,
      rejectedCoachIds,
    });

    if (!recommendation.coachId) {
      await this.prisma.notification.create({
        data: {
          gymId,
          recipientType: "ADMIN_BROADCAST",
          recipientId: gymId,
          type: "NO_COACH_AVAILABLE",
          title: "لا يوجد مدرب متاح",
          body: "تعذر ترشيح مدرب للمشترك الجديد لعدم توفر مدربين مطابقين للشروط حالياً",
          dedupeKey: `no-coach:${profileId}:${now.getTime()}`,
        },
      });
      return { assigned: false, reason: "NO_COACH_AVAILABLE" };
    }

    const assignedCoachId = recommendation.coachId;

    // 6. Create Assignment & moveToBack in Queue
    const assignment = await this.prisma.fitnessProfileAssignment.create({
      data: {
        gymId,
        profileId,
        coachId: assignedCoachId,
        source: "ROTATION",
        status: "PENDING",
      },
    });

    const updatedQueue = moveToBack(queue, assignedCoachId);
    for (const q of updatedQueue) {
      await this.prisma.coachRotationQueue.upsert({
        where: { gymId_coachId: { gymId, coachId: q.coachId } },
        create: { gymId, coachId: q.coachId, position: q.position },
        update: { position: q.position },
      });
    }

    await this.prisma.notification.create({
      data: {
        gymId,
        recipientType: "STAFF",
        recipientId: assignedCoachId,
        type: "NEW_MEMBER_ASSIGNMENT",
        title: "ترشيح عضو جديد",
        body: "تم ترشيح عضو جديد لك في جدول التدريب والمتابعة",
        dedupeKey: `fit-assign:${assignment.id}`,
      },
    });

    return {
      assigned: true,
      coachId: assignedCoachId,
      assignmentId: assignment.id,
      usedFallback: recommendation.usedFallback,
    };
  }

  async getAssignments(gymId: string, status?: string, coachId?: string) {
    const where: any = { gymId };
    if (status) where.status = status;
    if (coachId) where.coachId = coachId;

    return this.prisma.fitnessProfileAssignment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        profile: {
          include: {
            member: {
              select: { id: true, name: true, phone: true, code: true },
            },
          },
        },
      },
    });
  }

  async acceptAssignment(gymId: string, assignmentId: string, coachId: string) {
    const assignment = await this.prisma.fitnessProfileAssignment.findFirst({
      where: { id: assignmentId, gymId },
      include: { profile: true },
    });

    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.status !== "PENDING") {
      throw new BadRequestException("NOT_PENDING");
    }
    if (assignment.coachId !== coachId) {
      throw new ForbiddenException("NOT_YOUR_ASSIGNMENT");
    }

    const settings = await this.getGymSettings(gymId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fitnessProfileAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      });

      // Upsert CoachTrainee & grant free sessions
      const existingTrainee = await tx.coachTrainee.findFirst({
        where: {
          gymId,
          coachId,
          memberId: assignment.profile.memberId,
        },
      });

      if (existingTrainee) {
        await tx.coachTrainee.update({
          where: { id: existingTrainee.id },
          data: {
            isActive: true,
            freeSessionsGranted: { increment: settings.freeSessions },
          },
        });
      } else {
        await tx.coachTrainee.create({
          data: {
            gymId,
            coachId,
            memberId: assignment.profile.memberId,
            isActive: true,
            freeSessionsGranted: settings.freeSessions,
            freeSessionsUsed: 0,
          },
        });
      }

      await tx.notification.create({
        data: {
          gymId,
          recipientType: "ADMIN_BROADCAST",
          recipientId: gymId,
          type: "ASSIGNMENT_ACCEPTED",
          title: "قبول تكليف عضو",
          body: `قبل المدرب تكليف العضو، وتم منح ${settings.freeSessions} جلسات مجانية`,
          dedupeKey: `fit-accept:${assignmentId}`,
        },
      });

      return updated;
    });
  }

  async rejectAssignment(
    gymId: string,
    assignmentId: string,
    coachId: string,
    dto: RejectFitnessAssignmentDto
  ) {
    const assignment = await this.prisma.fitnessProfileAssignment.findFirst({
      where: { id: assignmentId, gymId },
    });

    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.status !== "PENDING") {
      throw new BadRequestException("NOT_PENDING");
    }
    if (assignment.coachId !== coachId) {
      throw new ForbiddenException("NOT_YOUR_ASSIGNMENT");
    }

    const updated = await this.prisma.fitnessProfileAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "REJECTED",
        rejectionReason: dto.reason,
        respondedAt: new Date(),
      },
    });

    await this.prisma.notification.create({
      data: {
        gymId,
        recipientType: "ADMIN_BROADCAST",
        recipientId: gymId,
        type: "ASSIGNMENT_REJECTED",
        title: "رفض تكليف عضو",
        body: `اعتذر المدرب عن تكليف العضو لسبب: ${dto.reason}`,
        dedupeKey: `fit-rej:${assignmentId}`,
      },
    });

    // Re-trigger rotation automatically
    await this.triggerRotation(gymId, assignment.profileId);

    return updated;
  }

  async assignManually(
    gymId: string,
    profileId: string,
    dto: AssignFitnessProfileDto,
    actorId: string
  ) {
    const profile = await this.prisma.fitnessProfile.findFirst({
      where: { id: profileId, gymId },
    });
    if (!profile) throw new NotFoundException("Profile not found");

    const settings = await this.getGymSettings(gymId);

    return this.prisma.$transaction(async (tx) => {
      // Mark all pending assignments as SUPERSEDED
      await tx.fitnessProfileAssignment.updateMany({
        where: { profileId, status: "PENDING" },
        data: { status: "SUPERSEDED" },
      });

      // Create MANUAL accepted assignment
      const assignment = await tx.fitnessProfileAssignment.create({
        data: {
          gymId,
          profileId,
          coachId: dto.coachId,
          source: "MANUAL",
          status: "ACCEPTED",
          respondedAt: new Date(),
          createdById: actorId,
        },
      });

      // Upsert CoachTrainee
      const existingTrainee = await tx.coachTrainee.findFirst({
        where: {
          gymId,
          coachId: dto.coachId,
          memberId: profile.memberId,
        },
      });

      if (existingTrainee) {
        await tx.coachTrainee.update({
          where: { id: existingTrainee.id },
          data: {
            isActive: true,
            freeSessionsGranted: { increment: settings.freeSessions },
          },
        });
      } else {
        await tx.coachTrainee.create({
          data: {
            gymId,
            coachId: dto.coachId,
            memberId: profile.memberId,
            isActive: true,
            freeSessionsGranted: settings.freeSessions,
            freeSessionsUsed: 0,
          },
        });
      }

      // Move coach to back of queue
      const queueEntries = await tx.coachRotationQueue.findMany({
        where: { gymId },
        orderBy: { position: "asc" },
      });
      const queue: QueueEntry[] = queueEntries.map((q) => ({
        coachId: q.coachId,
        position: q.position,
      }));
      const updatedQueue = moveToBack(queue, dto.coachId);

      for (const q of updatedQueue) {
        await tx.coachRotationQueue.upsert({
          where: { gymId_coachId: { gymId, coachId: q.coachId } },
          create: { gymId, coachId: q.coachId, position: q.position },
          update: { position: q.position },
        });
      }

      return assignment;
    });
  }

  async getFitnessProfile(gymId: string, memberId: string) {
    return this.prisma.fitnessProfile.findUnique({
      where: { memberId },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        assignments: {
          include: { coach: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async updateFitnessProfile(gymId: string, memberId: string, dto: UpdateFitnessProfileDto) {
    return this.prisma.fitnessProfile.upsert({
      where: { memberId },
      create: {
        gymId,
        memberId,
        ...dto,
      },
      update: {
        ...dto,
      },
    });
  }

  async getAssessments(gymId: string, memberId: string) {
    return this.prisma.fitnessAssessment.findMany({
      where: { gymId, memberId },
      orderBy: { assessmentDate: "desc" },
    });
  }

  async createAssessment(
    gymId: string,
    memberId: string,
    dto: CreateFitnessAssessmentDto,
    actorId?: string
  ) {
    return this.prisma.fitnessAssessment.create({
      data: {
        gymId,
        memberId,
        metrics: dto.metrics as any,
        assessmentDate: dto.assessmentDate ? new Date(dto.assessmentDate) : new Date(),
        createdById: actorId,
      },
    });
  }

  async getRotationQueue(gymId: string) {
    return this.prisma.coachRotationQueue.findMany({
      where: { gymId },
      orderBy: { position: "asc" },
      include: {
        coach: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });
  }

  async updateRotationQueue(gymId: string, dto: UpdateRotationQueueDto) {
    for (const item of dto.queue) {
      await this.prisma.coachRotationQueue.upsert({
        where: { gymId_coachId: { gymId, coachId: item.coachId } },
        create: { gymId, coachId: item.coachId, position: item.position },
        update: { position: item.position },
      });
    }
    return this.getRotationQueue(gymId);
  }
}
