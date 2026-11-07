import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type { CreateProductDto, UpdateProductDto } from "@gym/contracts";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(gymId: string, active?: boolean) {
    const where: any = { gymId };
    if (active !== undefined) where.isActive = active;

    const items = await this.prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return items.map((p) => ({
      id: p.id,
      gymId: p.gymId,
      name: p.name,
      price: decimalToPiasters(p.price),
      stock: p.stock,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async create(gymId: string, actorId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({
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
        code: "PRODUCT_EXISTS",
        message: "A product with this name already exists in this gym",
      });
    }

    const created = await this.prisma.product.create({
      data: {
        gymId,
        name: dto.name.trim(),
        price: piastersToDecimal(dto.price),
        stock: dto.stock ?? 0,
        isActive: true,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PRODUCT_CREATE",
      entityType: "Product",
      entityId: created.id,
      after: { name: created.name, price: dto.price, stock: dto.stock },
    });

    return {
      id: created.id,
      gymId: created.gymId,
      name: created.name,
      price: decimalToPiasters(created.price),
      stock: created.stock,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async update(gymId: string, actorId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, gymId },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Product not found",
      });
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.prisma.product.findUnique({
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
          code: "PRODUCT_EXISTS",
          message: "A product with this name already exists in this gym",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.price !== undefined) data.price = piastersToDecimal(dto.price);
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.product.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "PRODUCT_UPDATE",
      entityType: "Product",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      gymId: updated.gymId,
      name: updated.name,
      price: decimalToPiasters(updated.price),
      stock: updated.stock,
      isActive: updated.isActive,
    };
  }
}
