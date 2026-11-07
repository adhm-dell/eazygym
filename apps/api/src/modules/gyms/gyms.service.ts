import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
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
}
