import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";

@Injectable()
export class WalletService {
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

  async topup(
    gymId: string,
    actorId: string,
    memberId: string,
    amount: number,
    method: "CASH" | "INSTAPAY" | "CARD",
    note?: string
  ) {
    const shift = await this.getOpenShift(gymId, actorId);
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { wallet: true },
    });

    if (!member || !member.wallet) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member or wallet not found",
      });
    }

    const result = await this.prisma.runInTransaction(async (tx) => {
      const voucher = await tx.cashVoucher.create({
        data: {
          gymId,
          shiftId: shift.id,
          type: "RECEIPT",
          amount: piastersToDecimal(amount),
          method,
          memberId: member.id,
          reason: note || "سند قبض شحن محفظة",
          createdById: actorId,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: member.wallet!.id },
        data: { balance: { increment: piastersToDecimal(amount) } },
      });

      const txRow = await tx.walletTransaction.create({
        data: {
          gymId,
          walletId: updatedWallet.id,
          type: "TOPUP",
          amount: piastersToDecimal(amount),
          balanceAfter: updatedWallet.balance,
          voucherId: voucher.id,
          note: note || `Topup via Voucher ${voucher.id}`,
          createdById: actorId,
        },
      });

      return {
        balance: decimalToPiasters(updatedWallet.balance),
        voucherId: voucher.id,
        transactionId: txRow.id,
      };
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "WALLET_TOPUP",
      entityType: "Wallet",
      entityId: member.wallet.id,
      after: { amount, method, balance: result.balance },
    });

    return result;
  }

  async payout(
    gymId: string,
    actorId: string,
    memberId: string,
    amount: number,
    note?: string
  ) {
    const shift = await this.getOpenShift(gymId, actorId);
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { wallet: true },
    });

    if (!member || !member.wallet) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member or wallet not found",
      });
    }

    const currentBalance = decimalToPiasters(member.wallet.balance);
    if (currentBalance < amount) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "INSUFFICIENT_WALLET_BALANCE",
        message: `Insufficient wallet balance. Available: ${currentBalance}, Requested: ${amount}`,
      });
    }

    const result = await this.prisma.runInTransaction(async (tx) => {
      const voucher = await tx.cashVoucher.create({
        data: {
          gymId,
          shiftId: shift.id,
          type: "DISBURSEMENT",
          amount: piastersToDecimal(amount),
          method: "CASH",
          memberId: member.id,
          reason: note || "سند صرف استرداد رصيد محفظة",
          createdById: actorId,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: member.wallet!.id },
        data: { balance: { decrement: piastersToDecimal(amount) } },
      });

      const txRow = await tx.walletTransaction.create({
        data: {
          gymId,
          walletId: updatedWallet.id,
          type: "PAYOUT",
          amount: piastersToDecimal(-amount),
          balanceAfter: updatedWallet.balance,
          voucherId: voucher.id,
          note: note || `Payout via Voucher ${voucher.id}`,
          createdById: actorId,
        },
      });

      return {
        balance: decimalToPiasters(updatedWallet.balance),
        voucherId: voucher.id,
        transactionId: txRow.id,
      };
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "WALLET_PAYOUT",
      entityType: "Wallet",
      entityId: member.wallet.id,
      after: { amount, balance: result.balance },
    });

    return result;
  }

  async adjust(
    gymId: string,
    actorId: string,
    memberId: string,
    signedAmount: number,
    note: string
  ) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { wallet: true },
    });

    if (!member || !member.wallet) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member or wallet not found",
      });
    }

    const currentBalance = decimalToPiasters(member.wallet.balance);
    if (currentBalance + signedAmount < 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "WALLET_CANNOT_BE_NEGATIVE",
        message: "Wallet balance cannot be negative",
      });
    }

    const result = await this.prisma.runInTransaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: member.wallet!.id },
        data: { balance: { increment: piastersToDecimal(signedAmount) } },
      });

      const txRow = await tx.walletTransaction.create({
        data: {
          gymId,
          walletId: updatedWallet.id,
          type: "ADJUSTMENT",
          amount: piastersToDecimal(signedAmount),
          balanceAfter: updatedWallet.balance,
          note,
          createdById: actorId,
        },
      });

      return {
        balance: decimalToPiasters(updatedWallet.balance),
        transactionId: txRow.id,
      };
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "WALLET_ADJUST",
      entityType: "Wallet",
      entityId: member.wallet.id,
      after: { signedAmount, note, balance: result.balance },
    });

    return result;
  }
}
