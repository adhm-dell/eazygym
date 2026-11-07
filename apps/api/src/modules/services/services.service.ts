import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type { CreateServiceDto, UpdateServiceDto } from "@gym/contracts";

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(gymId: string, active?: boolean) {
    const where: any = { gymId };
    if (active !== undefined) where.isActive = active;

    const items = await this.prisma.service.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return items.map((s) => ({
      id: s.id,
      gymId: s.gymId,
      name: s.name,
      price: decimalToPiasters(s.price),
      sellableAtPos: s.sellableAtPos,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async create(gymId: string, actorId: string, dto: CreateServiceDto) {
    const existing = await this.prisma.service.findUnique({
      where: {
        gymId_name: {
          gymId,
          name: dto.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: "SERVICE_EXISTS",
        message: "A service with this name already exists in this gym",
      });
    }

    const created = await this.prisma.service.create({
      data: {
        gymId,
        name: dto.name.trim(),
        price: piastersToDecimal(dto.price),
        sellableAtPos: dto.sellableAtPos,
        isActive: true,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SERVICE_CREATE",
      entityType: "Service",
      entityId: created.id,
      after: { name: created.name, price: dto.price },
    });

    return {
      id: created.id,
      gymId: created.gymId,
      name: created.name,
      price: decimalToPiasters(created.price),
      sellableAtPos: created.sellableAtPos,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async update(gymId: string, actorId: string, id: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.service.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Service not found",
      });
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.prisma.service.findUnique({
        where: {
          gymId_name: {
            gymId,
            name: dto.name.trim(),
          },
        },
      });
      if (duplicate) {
        throw new ConflictException({
          statusCode: 409,
          code: "SERVICE_EXISTS",
          message: "A service with this name already exists in this gym",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.price !== undefined) data.price = piastersToDecimal(dto.price);
    if (dto.sellableAtPos !== undefined) data.sellableAtPos = dto.sellableAtPos;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.service.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SERVICE_UPDATE",
      entityType: "Service",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      gymId: updated.gymId,
      name: updated.name,
      price: decimalToPiasters(updated.price),
      sellableAtPos: updated.sellableAtPos,
      isActive: updated.isActive,
    };
  }
}
