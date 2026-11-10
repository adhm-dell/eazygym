import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { piastersToDecimal, decimalToPiasters } from "@gym/db";
import type { CreateStaffDto, UpdateStaffDto } from "@gym/contracts";

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService
  ) {}

  async list(gymId: string) {
    const staffList = await this.prisma.staff.findMany({
      where: { gymId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        gymId: true,
        name: true,
        email: true,
        role: true,
        baseSalary: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return staffList.map((s) => ({
      ...s,
      baseSalary: decimalToPiasters(s.baseSalary),
    }));
  }

  async getById(gymId: string, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, gymId },
      select: {
        id: true,
        gymId: true,
        name: true,
        email: true,
        role: true,
        baseSalary: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!staff) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Staff member not found",
      });
    }

    return {
      ...staff,
      baseSalary: decimalToPiasters(staff.baseSalary),
    };
  }

  async create(gymId: string, actorId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.staff.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: "EMAIL_EXISTS",
        message: "A staff member with this email already exists",
      });
    }

    const password = dto.password?.trim();
    const WEAK = new Set(["123456", "12345678", "password", "admin123", "1234567890"]);
    if (!password || password.length < 10 || WEAK.has(password.toLowerCase())) {
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_PASSWORD",
        message: "Staff password must be at least 10 characters and not a common password",
      });
    }
    const passwordHash = await this.authService.hashPassword(password);

    const created = await this.prisma.staff.create({
      data: {
        gymId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        baseSalary: dto.baseSalary !== undefined ? piastersToDecimal(dto.baseSalary) : 0,
        isActive: true,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "STAFF_CREATE",
      entityType: "Staff",
      entityId: created.id,
      after: {
        name: created.name,
        email: created.email,
        role: created.role,
      },
    });

    return {
      id: created.id,
      gymId: created.gymId,
      name: created.name,
      email: created.email,
      role: created.role,
      baseSalary: decimalToPiasters(created.baseSalary),
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }

  async update(gymId: string, actorId: string, id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, gymId },
    });

    if (!staff) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Staff member not found in this gym",
      });
    }

    // Check last admin rule:
    // If current staff is GYM_ADMIN and is being deactivated or changed to another role
    const isDemotingOrDeactivatingAdmin =
      staff.role === "GYM_ADMIN" &&
      ((dto.isActive === false && staff.isActive) ||
        (dto.role !== undefined && dto.role !== "GYM_ADMIN"));

    if (isDemotingOrDeactivatingAdmin) {
      const otherAdminsCount = await this.prisma.staff.count({
        where: {
          gymId,
          role: "GYM_ADMIN",
          isActive: true,
          id: { not: staff.id },
        },
      });

      if (otherAdminsCount === 0) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: "LAST_ADMIN",
          message: "Cannot deactivate or demote the last GYM_ADMIN in this gym",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.baseSalary !== undefined) data.baseSalary = piastersToDecimal(dto.baseSalary);
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
    }

    const updated = await this.prisma.staff.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "STAFF_UPDATE",
      entityType: "Staff",
      entityId: updated.id,
      before: {
        name: staff.name,
        role: staff.role,
        isActive: staff.isActive,
      },
      after: {
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      },
    });

    return {
      id: updated.id,
      gymId: updated.gymId,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      baseSalary: decimalToPiasters(updated.baseSalary),
      isActive: updated.isActive,
      updatedAt: new Date(),
    };
  }
}
