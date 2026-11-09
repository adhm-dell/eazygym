import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { UpdateGymSettingsDto } from "@gym/contracts";

@Injectable()
export class GymsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getSettings(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Gym not found",
      });
    }

    return {
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      timezone: gym.timezone,
      currency: gym.currency,
      defaultMinUpfrontPercent: Number(gym.defaultMinUpfrontPercent),
      defaultDueAfterDays: gym.defaultDueAfterDays,
      defaultDueAfterPercent: gym.defaultDueAfterPercent !== null ? Number(gym.defaultDueAfterPercent) : null,
      classEntryMode: gym.classEntryMode,
      classCheckinEarlyMinutes: gym.classCheckinEarlyMinutes,
      expiryNotifyDays: gym.expiryNotifyDays,
      maxCoachBreaksPerDay: gym.maxCoachBreaksPerDay,
      coachBreakDurationMinutes: gym.coachBreakDurationMinutes,
      freeSessionsOnFitnessProfile: gym.freeSessionsOnFitnessProfile,
      manualDiscountLimitPercent: Number(gym.manualDiscountLimitPercent),
      isActive: gym.isActive,
    };
  }

  async updateSettings(gymId: string, actorId: string, dto: UpdateGymSettingsDto) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Gym not found",
      });
    }

    // Range validations
    if (dto.defaultMinUpfrontPercent !== undefined) {
      if (dto.defaultMinUpfrontPercent < 0 || dto.defaultMinUpfrontPercent > 100) {
        throw new BadRequestException({
          statusCode: 400,
          code: "INVALID_RANGE",
          message: "defaultMinUpfrontPercent must be between 0 and 100",
        });
      }
    }
    if (dto.manualDiscountLimitPercent !== undefined) {
      if (dto.manualDiscountLimitPercent < 0 || dto.manualDiscountLimitPercent > 100) {
        throw new BadRequestException({
          statusCode: 400,
          code: "INVALID_RANGE",
          message: "manualDiscountLimitPercent must be between 0 and 100",
        });
      }
    }
    if (dto.defaultDueAfterDays !== undefined && dto.defaultDueAfterDays !== null) {
      if (dto.defaultDueAfterDays < 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: "INVALID_RANGE",
          message: "defaultDueAfterDays must be positive",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.defaultMinUpfrontPercent !== undefined) {
      data.defaultMinUpfrontPercent = dto.defaultMinUpfrontPercent;
    }
    if (dto.defaultDueAfterDays !== undefined) {
      data.defaultDueAfterDays = dto.defaultDueAfterDays;
    }
    if (dto.defaultDueAfterPercent !== undefined) {
      data.defaultDueAfterPercent = dto.defaultDueAfterPercent;
    }
    if (dto.classEntryMode !== undefined) {
      data.classEntryMode = dto.classEntryMode;
    }
    if (dto.classCheckinEarlyMinutes !== undefined) {
      data.classCheckinEarlyMinutes = dto.classCheckinEarlyMinutes;
    }
    if (dto.expiryNotifyDays !== undefined) {
      data.expiryNotifyDays = dto.expiryNotifyDays;
    }
    if (dto.maxCoachBreaksPerDay !== undefined) {
      data.maxCoachBreaksPerDay = dto.maxCoachBreaksPerDay;
    }
    if (dto.coachBreakDurationMinutes !== undefined) {
      data.coachBreakDurationMinutes = dto.coachBreakDurationMinutes;
    }
    if (dto.freeSessionsOnFitnessProfile !== undefined) {
      data.freeSessionsOnFitnessProfile = dto.freeSessionsOnFitnessProfile;
    }
    if (dto.manualDiscountLimitPercent !== undefined) {
      data.manualDiscountLimitPercent = dto.manualDiscountLimitPercent;
    }

    const updated = await this.prisma.gym.update({
      where: { id: gymId },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "GYM_SETTINGS_UPDATE",
      entityType: "Gym",
      entityId: gymId,
      before: gym,
      after: updated,
    });

    return this.getSettings(gymId);
  }

  // Super-admin platform gym management
  async listGyms() {
    const gyms = await this.prisma.gym.findMany({
      include: {
        _count: {
          select: {
            members: true,
            staff: true,
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return gyms.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      timezone: g.timezone,
      currency: g.currency,
      isActive: g.isActive,
      membersCount: g._count.members,
      staffCount: g._count.staff,
      subscriptionsCount: g._count.subscriptions,
      createdAt: g.createdAt,
    }));
  }

  async createGym(dto: {
    name: string;
    slug: string;
    timezone?: string;
    admin: { name: string; email: string; password?: string };
  }) {
    const existing = await this.prisma.gym.findUnique({
      where: { slug: dto.slug.toLowerCase().trim() },
    });
    if (existing) {
      throw new BadRequestException({
        statusCode: 400,
        code: "SLUG_EXISTS",
        message: "A gym with this slug already exists",
      });
    }

    const adminEmail = dto.admin.email.toLowerCase().trim();
    const existingStaff = await this.prisma.staff.findUnique({
      where: { email: adminEmail },
    });
    if (existingStaff) {
      throw new BadRequestException({
        statusCode: 400,
        code: "EMAIL_EXISTS",
        message: "Admin email already in use",
      });
    }

    const rawPassword = dto.admin.password || "123456";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          name: dto.name,
          slug: dto.slug.toLowerCase().trim(),
          timezone: dto.timezone || "Africa/Cairo",
          currency: "EGP",
          defaultMinUpfrontPercent: 30,
          defaultDueAfterDays: 30,
          classEntryMode: "RECEPTION_STARTS",
          classCheckinEarlyMinutes: 15,
          expiryNotifyDays: [7, 3, 1],
          maxCoachBreaksPerDay: 2,
          coachBreakDurationMinutes: 20,
          freeSessionsOnFitnessProfile: 1,
          manualDiscountLimitPercent: 10,
          isActive: true,
        },
      });

      const admin = await tx.staff.create({
        data: {
          gymId: gym.id,
          name: dto.admin.name,
          email: adminEmail,
          passwordHash,
          role: "GYM_ADMIN",
          baseSalary: 10000,
          isActive: true,
        },
      });

      return {
        gym,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      };
    });
  }

  async toggleGymActive(gymId: string, isActive: boolean) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Gym not found",
      });
    }

    const updated = await this.prisma.gym.update({
      where: { id: gymId },
      data: { isActive },
    });

    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
    };
  }
}
