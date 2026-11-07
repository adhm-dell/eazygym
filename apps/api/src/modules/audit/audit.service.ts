import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateAuditLogParams {
  gymId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
}

export interface QueryAuditLogsParams {
  gymId: string;
  entityType?: string;
  actorId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        gymId: params.gymId || null,
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before ? (params.before as any) : undefined,
        after: params.after ? (params.after as any) : undefined,
      },
    });
  }

  async list(params: QueryAuditLogsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      gymId: params.gymId,
    };

    if (params.entityType) {
      where.entityType = params.entityType;
    }
    if (params.actorId) {
      where.actorId = params.actorId;
    }
    if (params.fromDate || params.toDate) {
      where.createdAt = {};
      if (params.fromDate) {
        where.createdAt.gte = new Date(params.fromDate);
      }
      if (params.toDate) {
        where.createdAt.lte = new Date(params.toDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
