import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { evaluatePromotion, type PromotionRule, type CartItem } from "@gym/domain";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionPreviewDto,
} from "@gym/contracts";

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private validatePromotion(dto: CreatePromotionDto | UpdatePromotionDto) {
    const errors: string[] = [];

    if (dto.type === "PERCENT") {
      if (dto.value !== undefined && (dto.value < 0 || dto.value > 100)) {
        errors.push("value (0..100 for PERCENT)");
      }
    } else if (dto.type === "FIXED") {
      if (dto.value !== undefined && dto.value <= 0) {
        errors.push("value (> 0 for FIXED)");
      }
    }

    if (dto.startsAt && dto.endsAt) {
      if (new Date(dto.endsAt).getTime() <= new Date(dto.startsAt).getTime()) {
        errors.push("endsAt must be after startsAt");
      }
    }

    if (dto.maxUses !== undefined && dto.maxUses !== null && dto.maxUses <= 0) {
      errors.push("maxUses must be > 0");
    }

    if (dto.perMemberLimit !== undefined && dto.perMemberLimit !== null && dto.perMemberLimit <= 0) {
      errors.push("perMemberLimit must be > 0");
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_PROMOTION",
        message: "Promotion validation failed",
        details: { fields: errors },
      });
    }
  }

  async list(gymId: string) {
    const promotions = await this.prisma.promotion.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
      include: {
        plans: true,
      },
    });

    return promotions.map((p) => ({
      id: p.id,
      gymId: p.gymId,
      name: p.name,
      code: p.code,
      type: p.type,
      value: p.type === "FIXED" ? decimalToPiasters(p.value) : Number(p.value),
      maxDiscount: p.maxDiscount ? decimalToPiasters(p.maxDiscount) : null,
      minSubtotal: p.minSubtotal ? decimalToPiasters(p.minSubtotal) : null,
      itemKinds: p.itemKinds,
      planIds: p.plans.map((pl) => pl.planId),
      startsAt: p.startsAt ? p.startsAt.toISOString() : null,
      endsAt: p.endsAt ? p.endsAt.toISOString() : null,
      maxUses: p.maxUses,
      perMemberLimit: p.perMemberLimit,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getById(gymId: string, id: string) {
    const p = await this.prisma.promotion.findFirst({
      where: { id, gymId },
      include: {
        plans: true,
      },
    });

    if (!p) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Promotion not found",
      });
    }

    return {
      id: p.id,
      gymId: p.gymId,
      name: p.name,
      code: p.code,
      type: p.type,
      value: p.type === "FIXED" ? decimalToPiasters(p.value) : Number(p.value),
      maxDiscount: p.maxDiscount ? decimalToPiasters(p.maxDiscount) : null,
      minSubtotal: p.minSubtotal ? decimalToPiasters(p.minSubtotal) : null,
      itemKinds: p.itemKinds,
      planIds: p.plans.map((pl) => pl.planId),
      startsAt: p.startsAt ? p.startsAt.toISOString() : null,
      endsAt: p.endsAt ? p.endsAt.toISOString() : null,
      maxUses: p.maxUses,
      perMemberLimit: p.perMemberLimit,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    };
  }

  async create(gymId: string, actorId: string, dto: CreatePromotionDto) {
    this.validatePromotion(dto);

    if (dto.code) {
      const existing = await this.prisma.promotion.findFirst({
        where: {
          gymId,
          code: { equals: dto.code.trim(), mode: "insensitive" },
        },
      });
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          code: "PROMOTION_CODE_EXISTS",
          message: "A promotion with this code already exists in this gym",
        });
      }
    }

    const valueDecimal =
      dto.type === "FIXED"
        ? piastersToDecimal(dto.value)
        : piastersToDecimal(Math.round(dto.value * 100)); // for Decimal(12,2)

    const created = await this.prisma.promotion.create({
      data: {
        gymId,
        name: dto.name.trim(),
        code: dto.code ? dto.code.trim().toUpperCase() : null,
        type: dto.type as any,
        value: valueDecimal,
        maxDiscount: dto.maxDiscount ? piastersToDecimal(dto.maxDiscount) : null,
        minSubtotal: dto.minSubtotal ? piastersToDecimal(dto.minSubtotal) : null,
        itemKinds: dto.itemKinds as any,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        maxUses: dto.maxUses || null,
        perMemberLimit: dto.perMemberLimit || null,
        isActive: true,
        plans: {
          create: (dto.planIds || []).map((planId) => ({ planId })),
        },
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PROMOTION_CREATE",
      entityType: "Promotion",
      entityId: created.id,
      after: { name: created.name, code: created.code, type: created.type },
    });

    return this.getById(gymId, created.id);
  }

  async update(gymId: string, actorId: string, id: string, dto: UpdatePromotionDto) {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Promotion not found",
      });
    }

    this.validatePromotion(dto);

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const duplicate = await this.prisma.promotion.findFirst({
        where: {
          gymId,
          code: { equals: dto.code.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException({
          statusCode: 409,
          code: "PROMOTION_CODE_EXISTS",
          message: "A promotion with this code already exists in this gym",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code ? dto.code.trim().toUpperCase() : null;
    if (dto.value !== undefined && dto.type !== undefined) {
      data.value =
        dto.type === "FIXED"
          ? piastersToDecimal(dto.value)
          : piastersToDecimal(Math.round(dto.value * 100));
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.maxDiscount !== undefined) {
      data.maxDiscount = dto.maxDiscount ? piastersToDecimal(dto.maxDiscount) : null;
    }
    if (dto.minSubtotal !== undefined) {
      data.minSubtotal = dto.minSubtotal ? piastersToDecimal(dto.minSubtotal) : null;
    }
    if (dto.itemKinds !== undefined) data.itemKinds = dto.itemKinds;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.perMemberLimit !== undefined) data.perMemberLimit = dto.perMemberLimit;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.planIds !== undefined) {
      await this.prisma.promotionPlan.deleteMany({ where: { promotionId: id } });
      data.plans = {
        create: dto.planIds.map((planId) => ({ planId })),
      };
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PROMOTION_UPDATE",
      entityType: "Promotion",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return this.getById(gymId, updated.id);
  }

  async deactivate(gymId: string, actorId: string, id: string) {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Promotion not found",
      });
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PROMOTION_DEACTIVATE",
      entityType: "Promotion",
      entityId: updated.id,
    });

    return { success: true };
  }

  async activate(gymId: string, actorId: string, id: string) {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Promotion not found",
      });
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PROMOTION_ACTIVATE",
      entityType: "Promotion",
      entityId: updated.id,
    });

    return { success: true };
  }

  async preview(gymId: string, dto: PromotionPreviewDto) {
    let promo: any = null;

    if (dto.promotionId) {
      promo = await this.prisma.promotion.findFirst({
        where: { id: dto.promotionId, gymId },
        include: { plans: true },
      });
    } else if (dto.code) {
      promo = await this.prisma.promotion.findFirst({
        where: {
          gymId,
          code: { equals: dto.code.trim(), mode: "insensitive" },
        },
        include: { plans: true },
      });
    }

    if (!promo) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "WRONG_CODE",
        message: "Promotion not found or invalid promo code",
      });
    }

    const totalUses = await this.prisma.promotionRedemption.count({
      where: { promotionId: promo.id },
    });

    const memberUses = dto.memberId
      ? await this.prisma.promotionRedemption.count({
          where: { promotionId: promo.id, memberId: dto.memberId },
        })
      : 0;

    const promoRule: PromotionRule = {
      type: promo.type,
      value:
        promo.type === "FIXED"
          ? decimalToPiasters(promo.value)
          : Number(promo.value),
      maxDiscount: promo.maxDiscount ? decimalToPiasters(promo.maxDiscount) : null,
      minSubtotal: promo.minSubtotal ? decimalToPiasters(promo.minSubtotal) : null,
      itemKinds: promo.itemKinds,
      planIds: promo.plans.map((pl: any) => pl.planId),
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      maxUses: promo.maxUses,
      perMemberLimit: promo.perMemberLimit,
      isActive: promo.isActive,
      code: promo.code,
    };

    const cartItems: CartItem[] = dto.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      planId: i.planId,
      total: i.total,
    }));

    const result = evaluatePromotion({
      promo: promoRule,
      items: cartItems,
      now: new Date(),
      enteredCode: dto.code ?? null,
      totalRedemptions: totalUses,
      memberRedemptions: memberUses,
    });

    if (!result.applicable) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: result.reason,
        message: `Promotion is not applicable: ${result.reason}`,
      });
    }

    return {
      applicable: true,
      promotionId: promo.id,
      promotionName: promo.name,
      discount: result.discount,
      perItem: result.perItem,
    };
  }

  async getUsage(gymId: string, id: string) {
    const promo = await this.prisma.promotion.findFirst({
      where: { id, gymId },
    });

    if (!promo) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Promotion not found",
      });
    }

    const redemptions = await this.prisma.promotionRedemption.findMany({
      where: { promotionId: id, gymId },
    });

    const redemptionsCount = redemptions.length;
    const totalDiscount = redemptions.reduce(
      (sum, r) => sum + decimalToPiasters(r.amount),
      0
    );

    return {
      promotionId: id,
      promotionName: promo.name,
      redemptionsCount,
      totalDiscount,
    };
  }
}
