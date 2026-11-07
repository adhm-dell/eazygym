import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private async getOpenShift(gymId: string, staffId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { gymId, staffId, status: "OPEN" },
    });
    if (!shift) {
      const anyOpenShift = await this.prisma.shift.findFirst({
        where: { gymId, status: "OPEN" },
      });
      if (anyOpenShift) return anyOpenShift;

      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_OPEN_SHIFT",
        message: "No open shift found",
      });
    }
    return shift;
  }

  async createVoucher(
    gymId: string,
    actorId: string,
    type: "RECEIPT" | "DISBURSEMENT",
    amount: number,
    method: "CASH" | "INSTAPAY" | "CARD",
    note: string,
    memberId?: string
  ) {
    const shift = await this.getOpenShift(gymId, actorId);

    const voucher = await this.prisma.cashVoucher.create({
      data: {
        gymId,
        shiftId: shift.id,
        type: type as any,
        amount: piastersToDecimal(amount),
        method: method as any,
        memberId: memberId || null,
        reason: note,
        createdById: actorId,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: `VOUCHER_${type}`,
      entityType: "CashVoucher",
      entityId: voucher.id,
      after: { type, amount, method, reason: note },
    });

    return {
      id: voucher.id,
      gymId: voucher.gymId,
      type: voucher.type,
      amount: decimalToPiasters(voucher.amount),
      method: voucher.method,
      reason: voucher.reason,
      createdAt: voucher.createdAt.toISOString(),
    };
  }

  async list(gymId: string) {
    const vouchers = await this.prisma.cashVoucher.findMany({
      where: { gymId },
      orderBy: { createdAt: "desc" },
    });

    return vouchers.map((v) => ({
      id: v.id,
      gymId: v.gymId,
      type: v.type,
      amount: decimalToPiasters(v.amount),
      method: v.method,
      reason: v.reason,
      createdAt: v.createdAt.toISOString(),
    }));
  }
}
