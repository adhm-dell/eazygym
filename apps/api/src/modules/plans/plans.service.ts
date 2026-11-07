import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type { CreatePlanDto, UpdatePlanDto } from "@gym/contracts";

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  validatePlan(dto: CreatePlanDto | UpdatePlanDto, existingKind?: string) {
    const kind = dto.kind || existingKind;
    const errors: string[] = [];

    if (dto.durationDays !== undefined && dto.durationDays <= 0) {
      errors.push("durationDays");
    }
    if (dto.price !== undefined && dto.price < 0) {
      errors.push("price");
    }

    if (kind === "PT") {
      const duration = dto.durationDays || 30;
      const maxMilestones = Math.max(1, Math.ceil(duration / 30));
      if (
        dto.commissionMilestones !== undefined &&
        (dto.commissionMilestones < 1 || dto.commissionMilestones > maxMilestones)
      ) {
        errors.push("commissionMilestones");
      }
    }

    if (kind === "CLASS") {
      if (dto.sessionsPerWeek !== undefined && dto.sessionsPerWeek !== null && dto.sessionsPerWeek < 1) {
        errors.push("sessionsPerWeek");
      }
    }

    // Freeze consistency
    if (dto.freezeMaxCount !== undefined && dto.freezeMaxTotalDays !== undefined) {
      if ((dto.freezeMaxCount === 0 && dto.freezeMaxTotalDays > 0) || (dto.freezeMaxCount > 0 && dto.freezeMaxTotalDays === 0)) {
        errors.push("freezePolicy");
      }
    }

    if (dto.minUpfrontPercent !== undefined && dto.minUpfrontPercent !== null) {
      if (dto.minUpfrontPercent < 0 || dto.minUpfrontPercent > 100) {
        errors.push("minUpfrontPercent");
      }
    }

    if (dto.dueAfterDays !== undefined && dto.dueAfterDays !== null) {
      if (dto.dueAfterDays < 0) {
        errors.push("dueAfterDays");
      }
    }

    if (dto.dueAfterPercent !== undefined && dto.dueAfterPercent !== null) {
      if (dto.dueAfterPercent < 0 || dto.dueAfterPercent > 100) {
        errors.push("dueAfterPercent");
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_PLAN",
        message: "Plan validation failed",
        details: { fields: errors },
      });
    }
  }

  async list(gymId: string, kind?: string, active?: boolean) {
    const where: any = { gymId };
    if (kind) where.kind = kind;
    if (active !== undefined) where.isActive = active;

    const plans = await this.prisma.plan.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        includedServices: {
          include: { service: true },
        },
      },
    });

    return plans.map((p) => ({
      id: p.id,
      gymId: p.gymId,
      name: p.name,
      kind: p.kind,
      price: decimalToPiasters(p.price),
      durationDays: p.durationDays,
      grantsFloorAccess: p.grantsFloorAccess,
      totalSessions: p.totalSessions,
      sessionsPerWeek: p.sessionsPerWeek,
      freezeMaxCount: p.freezeMaxCount,
      freezeMaxTotalDays: p.freezeMaxTotalDays,
      minUpfrontPercent: p.minUpfrontPercent ? Number(p.minUpfrontPercent) : null,
      dueAfterDays: p.dueAfterDays,
      dueAfterPercent: p.dueAfterPercent ? Number(p.dueAfterPercent) : null,
      maxInvitations: p.maxInvitations,
      freePtSessions: p.freePtSessions,
      commissionable: p.commissionable,
      commissionMilestones: p.commissionMilestones,
      isActive: p.isActive,
      includedServices: p.includedServices.map((is) => ({
        serviceId: is.serviceId,
        serviceName: is.service.name,
        quantity: is.quantity,
      })),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async getById(gymId: string, id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id, gymId },
      include: {
        includedServices: {
          include: { service: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Plan not found",
      });
    }

    return {
      id: plan.id,
      gymId: plan.gymId,
      name: plan.name,
      kind: plan.kind,
      price: decimalToPiasters(plan.price),
      durationDays: plan.durationDays,
      grantsFloorAccess: plan.grantsFloorAccess,
      totalSessions: plan.totalSessions,
      sessionsPerWeek: plan.sessionsPerWeek,
      freezeMaxCount: plan.freezeMaxCount,
      freezeMaxTotalDays: plan.freezeMaxTotalDays,
      minUpfrontPercent: plan.minUpfrontPercent ? Number(plan.minUpfrontPercent) : null,
      dueAfterDays: plan.dueAfterDays,
      dueAfterPercent: plan.dueAfterPercent ? Number(plan.dueAfterPercent) : null,
      maxInvitations: plan.maxInvitations,
      freePtSessions: plan.freePtSessions,
      commissionable: plan.commissionable,
      commissionMilestones: plan.commissionMilestones,
      isActive: plan.isActive,
      includedServices: plan.includedServices.map((is) => ({
        serviceId: is.serviceId,
        serviceName: is.service.name,
        quantity: is.quantity,
      })),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  async create(gymId: string, actorId: string, dto: CreatePlanDto) {
    this.validatePlan(dto);

    const grantsFloorAccess =
      dto.grantsFloorAccess !== undefined
        ? dto.grantsFloorAccess
        : dto.kind === "PT"
        ? false
        : true;

    const commissionable =
      dto.commissionable !== undefined ? dto.commissionable : dto.kind === "PT";

    const created = await this.prisma.plan.create({
      data: {
        gymId,
        name: dto.name,
        kind: dto.kind as any,
        price: piastersToDecimal(dto.price),
        durationDays: dto.durationDays,
        grantsFloorAccess,
        totalSessions: dto.totalSessions || null,
        sessionsPerWeek: dto.sessionsPerWeek || null,
        freezeMaxCount: dto.freezeMaxCount ?? 0,
        freezeMaxTotalDays: dto.freezeMaxTotalDays ?? 0,
        minUpfrontPercent: dto.minUpfrontPercent ?? null,
        dueAfterDays: dto.dueAfterDays ?? null,
        dueAfterPercent: dto.dueAfterPercent ?? null,
        maxInvitations: dto.maxInvitations ?? 0,
        freePtSessions: dto.freePtSessions ?? 0,
        commissionable,
        commissionMilestones: dto.commissionMilestones ?? 1,
        isActive: true,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PLAN_CREATE",
      entityType: "Plan",
      entityId: created.id,
      after: { name: created.name, price: dto.price, kind: created.kind },
    });

    return this.getById(gymId, created.id);
  }

  async update(gymId: string, actorId: string, id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.plan.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Plan not found",
      });
    }

    this.validatePlan(dto, existing.kind);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = piastersToDecimal(dto.price);
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.grantsFloorAccess !== undefined) data.grantsFloorAccess = dto.grantsFloorAccess;
    if (dto.totalSessions !== undefined) data.totalSessions = dto.totalSessions;
    if (dto.sessionsPerWeek !== undefined) data.sessionsPerWeek = dto.sessionsPerWeek;
    if (dto.freezeMaxCount !== undefined) data.freezeMaxCount = dto.freezeMaxCount;
    if (dto.freezeMaxTotalDays !== undefined) data.freezeMaxTotalDays = dto.freezeMaxTotalDays;
    if (dto.minUpfrontPercent !== undefined) data.minUpfrontPercent = dto.minUpfrontPercent;
    if (dto.dueAfterDays !== undefined) data.dueAfterDays = dto.dueAfterDays;
    if (dto.dueAfterPercent !== undefined) data.dueAfterPercent = dto.dueAfterPercent;
    if (dto.maxInvitations !== undefined) data.maxInvitations = dto.maxInvitations;
    if (dto.freePtSessions !== undefined) data.freePtSessions = dto.freePtSessions;
    if (dto.commissionable !== undefined) data.commissionable = dto.commissionable;
    if (dto.commissionMilestones !== undefined) data.commissionMilestones = dto.commissionMilestones;

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PLAN_UPDATE",
      entityType: "Plan",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return this.getById(gymId, updated.id);
  }

  async archive(gymId: string, actorId: string, id: string) {
    const existing = await this.prisma.plan.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Plan not found",
      });
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PLAN_ARCHIVE",
      entityType: "Plan",
      entityId: updated.id,
    });

    return { success: true };
  }
}
