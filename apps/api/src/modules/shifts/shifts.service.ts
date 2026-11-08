import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  expectedCash,
  shiftVariance,
  canCloseShift,
  type ShiftCashTotals,
} from "@gym/domain";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type {
  OpenShiftDto,
  CloseShiftDto,
  CloseAllShiftsDto,
} from "@gym/contracts";

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async openShift(gymId: string, staffId: string, dto: OpenShiftDto) {
    const existing = await this.prisma.shift.findFirst({
      where: { gymId, staffId, status: "OPEN" },
    });

    if (existing) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "SHIFT_ALREADY_OPEN",
        message: "Staff member already has an open shift",
      });
    }

    const shift = await this.prisma.shift.create({
      data: {
        gymId,
        staffId,
        status: "OPEN",
        openingCash: piastersToDecimal(dto.openingCash),
      },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
    });

    await this.auditService.log({
      gymId,
      actorId: staffId,
      action: "SHIFT_OPEN",
      entityType: "Shift",
      entityId: shift.id,
      after: {
        openingCash: dto.openingCash,
      },
    });

    return {
      ...shift,
      openingCash: dto.openingCash,
      expectedCash: dto.openingCash,
      countedCash: null,
      variance: null,
    };
  }

  async getCurrentShift(gymId: string, staffId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { gymId, staffId, status: "OPEN" },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
    });

    if (!shift) return null;

    const summary = await this.calculateShiftSummary(shift);
    return {
      id: shift.id,
      gymId: shift.gymId,
      staffId: shift.staffId,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: decimalToPiasters(shift.openingCash),
      staff: shift.staff,
      ...summary,
    };
  }

  async calculateShiftSummary(shift: any) {
    // 1. Payments attached to shift
    const payments = await this.prisma.payment.findMany({
      where: { shiftId: shift.id },
    });

    let cashPayments = 0;
    let cardPayments = 0;
    let instapayPayments = 0;
    let walletPayments = 0;

    for (const p of payments) {
      const amt = decimalToPiasters(p.amount);
      switch (p.method) {
        case "CASH":
          cashPayments += amt;
          break;
        case "CARD":
          cardPayments += amt;
          break;
        case "INSTAPAY":
          instapayPayments += amt;
          break;
        case "WALLET":
          walletPayments += amt;
          break;
      }
    }

    // 2. Cash vouchers
    const vouchers = await this.prisma.cashVoucher.findMany({
      where: { shiftId: shift.id },
    });

    let cashReceiptVouchers = 0;
    let cashDisbursementVouchers = 0;

    for (const v of vouchers) {
      const amt = decimalToPiasters(v.amount);
      if (v.type === "RECEIPT") {
        cashReceiptVouchers += amt;
      } else if (v.type === "DISBURSEMENT") {
        cashDisbursementVouchers += amt;
      }
    }

    // 3. Operational Expenses from drawer (not voided)
    const expenses = await this.prisma.expense.findMany({
      where: {
        shiftId: shift.id,
        paidFromDrawer: true,
        voidedAt: null,
      },
    });

    const expensesFromDrawer = expenses.reduce(
      (sum, e) => sum + decimalToPiasters(e.amount),
      0
    );

    // 4. Invoices count
    const invoicesCount = await this.prisma.invoice.count({
      where: { shiftId: shift.id },
    });

    const openingCash = decimalToPiasters(shift.openingCash);

    const totals: ShiftCashTotals = {
      openingCash,
      cashPayments,
      cashReceiptVouchers,
      expensesFromDrawer,
      cashDisbursementVouchers,
    };

    const expected = expectedCash(totals);

    return {
      totals,
      expectedCash: expected,
      cashPayments,
      cardPayments,
      instapayPayments,
      walletPayments,
      cashReceiptVouchers,
      cashDisbursementVouchers,
      expensesFromDrawer,
      invoicesCount,
    };
  }

  async closeShift(
    gymId: string,
    actorId: string,
    actorRole: string,
    id: string,
    dto: CloseShiftDto
  ) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, gymId },
    });

    if (!shift) {
      throw new NotFoundException({
        statusCode: 404,
        code: "SHIFT_NOT_FOUND",
        message: `Shift ${id} not found`,
      });
    }

    const isAdmin = actorRole === "GYM_ADMIN" || actorRole === "SUPER_ADMIN";
    const check = canCloseShift({
      shiftStatus: shift.status as any,
      shiftOwnerId: shift.staffId,
      actorId,
      actorIsAdmin: isAdmin,
    });

    if (check === "ALREADY_CLOSED") {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "ALREADY_CLOSED",
        message: "Shift is already closed",
      });
    }

    if (check === "NOT_OWNER") {
      throw new ForbiddenException({
        statusCode: 403,
        code: "NOT_OWNER",
        message: "Only the shift owner or an admin can close this shift",
      });
    }

    const summary = await this.calculateShiftSummary(shift);
    const expected = summary.expectedCash;
    const counted = dto.countedCash;
    const variance = shiftVariance(expected, counted);

    const updated = await this.prisma.shift.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: actorId,
        expectedCash: piastersToDecimal(expected),
        countedCash: piastersToDecimal(counted),
        variance: piastersToDecimal(variance),
        note: dto.note || null,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "SHIFT_CLOSE",
      entityType: "Shift",
      entityId: id,
      after: {
        expectedCash: expected,
        countedCash: counted,
        variance,
        closedById: actorId,
        note: dto.note,
      },
    });

    return {
      ...updated,
      openingCash: decimalToPiasters(updated.openingCash),
      expectedCash: expected,
      countedCash: counted,
      variance,
    };
  }

  async closeAllShifts(gymId: string, actorId: string, dto: CloseAllShiftsDto) {
    const openShifts = await this.prisma.shift.findMany({
      where: { gymId, status: "OPEN" },
    });

    const closed = [];
    for (const s of openShifts) {
      const summary = await this.calculateShiftSummary(s);
      const updated = await this.prisma.shift.update({
        where: { id: s.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: actorId,
          expectedCash: piastersToDecimal(summary.expectedCash),
          countedCash: null,
          variance: null,
          note: `إغلاق إداري شامل: ${dto.note}`,
        },
      });

      await this.auditService.log({
        gymId,
        actorId,
        action: "SHIFT_CLOSE_ADMIN_ALL",
        entityType: "Shift",
        entityId: s.id,
        after: {
          note: dto.note,
        },
      });

      closed.push({
        ...updated,
        openingCash: decimalToPiasters(updated.openingCash),
        expectedCash: summary.expectedCash,
        countedCash: null,
        variance: null,
      });
    }

    return closed;
  }

  async listShifts(
    gymId: string,
    query: {
      staffId?: string;
      status?: string;
      hasVariance?: string;
    }
  ) {
    const shifts = await this.prisma.shift.findMany({
      where: {
        gymId,
        ...(query.staffId ? { staffId: query.staffId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.hasVariance === "true" ? { NOT: { variance: 0 } } : {}),
      },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return shifts.map((s) => ({
      ...s,
      openingCash: decimalToPiasters(s.openingCash),
      expectedCash: s.expectedCash !== null ? decimalToPiasters(s.expectedCash) : null,
      countedCash: s.countedCash !== null ? decimalToPiasters(s.countedCash) : null,
      variance: s.variance !== null ? decimalToPiasters(s.variance) : null,
    }));
  }

  async getShiftReport(gymId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, gymId },
      include: {
        staff: { select: { id: true, name: true, role: true } },
      },
    });

    if (!shift) {
      throw new NotFoundException({
        statusCode: 404,
        code: "SHIFT_NOT_FOUND",
        message: `Shift ${id} not found`,
      });
    }

    const summary = await this.calculateShiftSummary(shift);
    const payments = await this.prisma.payment.findMany({
      where: { shiftId: shift.id },
      include: {
        invoice: { select: { id: true, number: true, memberId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const expenses = await this.prisma.expense.findMany({
      where: { shiftId: shift.id },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const vouchers = await this.prisma.cashVoucher.findMany({
      where: { shiftId: shift.id },
      orderBy: { createdAt: "desc" },
    });

    return {
      ...summary,
      shift: {
        ...shift,
        openingCash: decimalToPiasters(shift.openingCash),
        expectedCash: shift.expectedCash !== null ? decimalToPiasters(shift.expectedCash) : summary.expectedCash,
        countedCash: shift.countedCash !== null ? decimalToPiasters(shift.countedCash) : null,
        variance: shift.variance !== null ? decimalToPiasters(shift.variance) : null,
      },
      countedCash: shift.countedCash !== null ? decimalToPiasters(shift.countedCash) : null,
      variance: shift.variance !== null ? decimalToPiasters(shift.variance) : null,
      summary,
      records: {
        payments: payments.map((p) => ({
          ...p,
          amount: decimalToPiasters(p.amount),
        })),
        expenses: expenses.map((e) => ({
          ...e,
          amount: decimalToPiasters(e.amount),
        })),
        vouchers: vouchers.map((v) => ({
          ...v,
          amount: decimalToPiasters(v.amount),
        })),
      },
    };
  }
}
