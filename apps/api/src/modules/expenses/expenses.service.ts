import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type {
  CreateExpenseDto,
  VoidExpenseDto,
} from "@gym/contracts";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async createExpense(gymId: string, actorId: string, dto: CreateExpenseDto) {
    const shift = await this.prisma.shift.findFirst({
      where: { gymId, staffId: actorId, status: "OPEN" },
    });

    if (!shift) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_OPEN_SHIFT",
        message: "An active open shift is required to record expenses",
      });
    }

    const expense = await this.prisma.expense.create({
      data: {
        gymId,
        shiftId: shift.id,
        category: dto.category,
        amount: piastersToDecimal(dto.amount),
        description: dto.description || null,
        paidFromDrawer: dto.paidFromDrawer,
        createdById: actorId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "EXPENSE_CREATE",
      entityType: "Expense",
      entityId: expense.id,
      after: {
        amount: dto.amount,
        category: dto.category,
        shiftId: shift.id,
        paidFromDrawer: dto.paidFromDrawer,
      },
    });

    return {
      ...expense,
      amount: dto.amount,
    };
  }

  async listExpenses(
    gymId: string,
    actorId: string,
    actorRole: string,
    query: { shiftId?: string; category?: string }
  ) {
    const isAdmin = actorRole === "GYM_ADMIN" || actorRole === "SUPER_ADMIN";
    const expenses = await this.prisma.expense.findMany({
      where: {
        gymId,
        ...(isAdmin ? {} : { createdById: actorId }),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return expenses.map((e) => ({
      ...e,
      amount: decimalToPiasters(e.amount),
    }));
  }

  async voidExpense(gymId: string, actorId: string, id: string, dto: { reason?: string; voidReason?: string }) {
    const reason = dto.reason || dto.voidReason;
    if (!reason) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "REASON_REQUIRED",
        message: "Void reason is required",
      });
    }

    const expense = await this.prisma.expense.findFirst({
      where: { id, gymId },
    });

    if (!expense) {
      throw new NotFoundException({
        statusCode: 404,
        code: "EXPENSE_NOT_FOUND",
        message: `Expense ${id} not found`,
      });
    }

    if (expense.voidedAt) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "ALREADY_VOIDED",
        message: "Expense is already voided",
      });
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidReason: reason,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "EXPENSE_VOID",
      entityType: "Expense",
      entityId: id,
      after: { voidReason: reason },
    });

    return {
      ...updated,
      amount: decimalToPiasters(updated.amount),
    };
  }
}
