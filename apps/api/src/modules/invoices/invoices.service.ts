import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NumberingService } from "../numbering/numbering.service";
import { PromotionsService } from "../promotions/promotions.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import {
  allocateProRata,
  planWalletUse,
  settleTender,
  type CartItem,
} from "@gym/domain";
import { decimalToPiasters, piastersToDecimal } from "@gym/db";
import type { CreateInvoiceDto, CollectPaymentDto } from "@gym/contracts";

interface PricedItem {
  kind: any;
  planId?: string | null;
  serviceId?: string | null;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPricePiasters: number;
  grossTotalPiasters: number;
  plan?: any;
  subscriptionOptions?: any;
}

@Injectable()
export class InvoicesService {
  private idempotencyCache = new Map<string, { result: any; createdAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly numberingService: NumberingService,
    private readonly promotionsService: PromotionsService,
    private readonly subscriptionsService: SubscriptionsService
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
        message: "No open shift found. An active shift is required for sales/payments.",
      });
    }
    return shift;
  }

  async create(
    gymId: string,
    actorId: string,
    actorRole: string,
    dto: CreateInvoiceDto,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const cached = this.idempotencyCache.get(`${gymId}:${idempotencyKey}`);
      if (cached && Date.now() - cached.createdAt < 24 * 3600 * 1000) {
        return cached.result;
      }
    }

    const shift = await this.getOpenShift(gymId, actorId);
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });

    // Walk-in check
    if (!dto.memberId) {
      const hasSub = dto.items.some((i) => i.kind === "SUBSCRIPTION");
      if (hasSub) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: "MEMBER_REQUIRED",
          message: "A member is required to purchase subscriptions",
        });
      }
    }

    // Load and price items
    const pricedItems: PricedItem[] = [];

    for (const item of dto.items) {
      if (item.kind === "SUBSCRIPTION") {
        if (!item.planId) {
          throw new BadRequestException({
            statusCode: 400,
            code: "INVALID_ITEM",
            message: "planId is required for subscription items",
          });
        }
        const plan = await this.prisma.plan.findFirst({
          where: { id: item.planId, gymId, isActive: true },
        });
        if (!plan) {
          throw new NotFoundException({
            statusCode: 404,
            code: "PLAN_NOT_FOUND",
            message: `Plan ${item.planId} not found or inactive`,
          });
        }
        const unitPrice =
          actorRole === "GYM_ADMIN" && item.unitPrice !== undefined
            ? item.unitPrice
            : decimalToPiasters(plan.price);

        pricedItems.push({
          kind: "SUBSCRIPTION",
          planId: plan.id,
          description: plan.name,
          quantity: item.quantity,
          unitPricePiasters: unitPrice,
          grossTotalPiasters: unitPrice * item.quantity,
          plan,
          subscriptionOptions: item.subscription,
        });
      } else if (item.kind === "SERVICE") {
        if (!item.serviceId) {
          throw new BadRequestException({
            statusCode: 400,
            code: "INVALID_ITEM",
            message: "serviceId is required for service items",
          });
        }
        const service = await this.prisma.service.findFirst({
          where: { id: item.serviceId, gymId, isActive: true },
        });
        if (!service) {
          throw new NotFoundException({
            statusCode: 404,
            code: "SERVICE_NOT_FOUND",
            message: `Service ${item.serviceId} not found or inactive`,
          });
        }
        const unitPrice =
          item.unitPrice !== undefined
            ? item.unitPrice
            : decimalToPiasters(service.price);

        pricedItems.push({
          kind: "SERVICE",
          serviceId: service.id,
          description: service.name,
          quantity: item.quantity,
          unitPricePiasters: unitPrice,
          grossTotalPiasters: unitPrice * item.quantity,
        });
      } else if (item.kind === "PRODUCT") {
        if (!item.productId) {
          throw new BadRequestException({
            statusCode: 400,
            code: "INVALID_ITEM",
            message: "productId is required for product items",
          });
        }
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, gymId, isActive: true },
        });
        if (!product) {
          throw new NotFoundException({
            statusCode: 404,
            code: "PRODUCT_NOT_FOUND",
            message: `Product ${item.productId} not found or inactive`,
          });
        }
        if (product.stock < item.quantity) {
          throw new UnprocessableEntityException({
            statusCode: 422,
            code: "OUT_OF_STOCK",
            message: `Insufficient stock for product ${product.name}. Available: ${product.stock}`,
          });
        }
        const unitPrice =
          item.unitPrice !== undefined
            ? item.unitPrice
            : decimalToPiasters(product.price);

        pricedItems.push({
          kind: "PRODUCT",
          productId: product.id,
          description: product.name,
          quantity: item.quantity,
          unitPricePiasters: unitPrice,
          grossTotalPiasters: unitPrice * item.quantity,
        });
      }
    }

    const subtotal = pricedItems.reduce((sum, i) => sum + i.grossTotalPiasters, 0);

    // Discounts
    let totalDiscount = 0;
    let appliedPromotionId: string | null = null;
    let discountNote: string | null = null;
    let discountApprovedById: string | null = null;
    let itemDiscounts: number[] = new Array(pricedItems.length).fill(0);

    if (dto.promotionCode || dto.promotionId) {
      if (dto.manualDiscount && dto.manualDiscount.amount > 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: "MULTIPLE_DISCOUNTS",
          message: "Only one of promotion or manual discount can be applied per invoice",
        });
      }

      const cartItems: CartItem[] = pricedItems.map((p, idx) => ({
        id: `item_${idx}`,
        kind: p.kind,
        planId: p.planId || undefined,
        total: p.grossTotalPiasters,
      }));

      const preview = await this.promotionsService.preview(gymId, {
        promotionId: dto.promotionId || undefined,
        code: dto.promotionCode || undefined,
        memberId: dto.memberId ? dto.memberId : undefined,
        items: cartItems as any,
      });

      totalDiscount = preview.discount;
      appliedPromotionId = preview.promotionId;
      itemDiscounts = preview.perItem.map((pi: any) => pi.discount);
    } else if (dto.manualDiscount && dto.manualDiscount.amount > 0) {
      const discountAmount = Math.min(dto.manualDiscount.amount, subtotal);
      totalDiscount = discountAmount;
      discountNote = dto.manualDiscount.note;

      const discountPercent = (discountAmount / subtotal) * 100;
      const limitPercent = gym ? Number(gym.manualDiscountLimitPercent) : 0;

      if (actorRole === "GYM_ADMIN" || actorRole === "SUPER_ADMIN") {
        discountApprovedById = actorId;
      } else if (discountPercent <= limitPercent) {
        discountApprovedById = actorId;
      } else {
        discountApprovedById = null;
      }

      itemDiscounts = allocateProRata(
        totalDiscount,
        pricedItems.map((i) => i.grossTotalPiasters)
      );
    }

    const netInvoiceTotal = Math.max(0, subtotal - totalDiscount);

    // Payments resolution
    let walletUseAmount = 0;
    let memberWallet: any = null;

    if (dto.memberId) {
      memberWallet = await this.prisma.wallet.findUnique({
        where: { memberId: dto.memberId },
      });
    }

    if (dto.useWallet !== false && memberWallet && Number(memberWallet.balance) > 0) {
      const walletBalance = decimalToPiasters(memberWallet.balance);
      const planned = planWalletUse({
        balance: walletBalance,
        due: netInvoiceTotal,
      });
      walletUseAmount = planned.fromWallet;
    }

    const tenderPayments: Array<{
      method: any;
      amount: number;
      reference?: string;
    }> = [];

    if (walletUseAmount > 0) {
      tenderPayments.push({
        method: "WALLET",
        amount: walletUseAmount,
        reference: "Wallet Auto-Apply",
      });
    }

    for (const p of dto.payments || []) {
      if (p.method === "WALLET") {
        const walletBalance = memberWallet ? decimalToPiasters(memberWallet.balance) : 0;
        if (p.amount > walletBalance) {
          throw new UnprocessableEntityException({
            statusCode: 422,
            code: "INSUFFICIENT_WALLET_BALANCE",
            message: "Insufficient wallet balance",
          });
        }
      }
      tenderPayments.push({
        method: p.method,
        amount: p.amount,
        reference: p.reference || undefined,
      });
    }

    const totalTendered = tenderPayments.reduce((sum, p) => sum + p.amount, 0);
    const settle = settleTender({
      due: netInvoiceTotal,
      tendered: totalTendered,
    });

    const netItemTotals: number[] = pricedItems.map((item, idx) =>
      Math.max(0, item.grossTotalPiasters - (itemDiscounts[idx] ?? 0))
    );

    const actualCollected = Math.min(totalTendered, netInvoiceTotal);

    // Execute atomic serializable transaction
    const result = await this.prisma.runInTransaction(async (tx) => {
      // 1. Invoice
      const invoiceCount = await tx.invoice.count({ where: { gymId } });
      const invoiceNumber = invoiceCount + 1;

      const invoice = await tx.invoice.create({
        data: {
          gymId,
          number: invoiceNumber,
          memberId: dto.memberId || null,
          status: actualCollected >= netInvoiceTotal ? "PAID" : "OPEN",
          subtotal: piastersToDecimal(subtotal),
          discount: piastersToDecimal(totalDiscount),
          promotionId: appliedPromotionId,
          discountNote,
          discountApprovedById,
          total: piastersToDecimal(netInvoiceTotal),
          note: dto.note || null,
          createdById: actorId,
          shiftId: shift.id,
        },
      });

      // 2. InvoiceItems & Subscriptions
      const createdItems: any[] = [];
      const createdSubscriptions: any[] = [];

      for (let i = 0; i < pricedItems.length; i++) {
        const pItem = pricedItems[i]!;
        const netTotal = netItemTotals[i] ?? 0;

        const invItem = await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            kind: pItem.kind,
            description: pItem.description,
            quantity: pItem.quantity,
            unitPrice: piastersToDecimal(pItem.unitPricePiasters),
            total: piastersToDecimal(netTotal),
            planId: pItem.planId || null,
            serviceId: pItem.serviceId || null,
            productId: pItem.productId || null,
          },
        });
        createdItems.push(invItem);

        if (pItem.kind === "SUBSCRIPTION" && dto.memberId) {
          const itemAllocatedCollected =
            netInvoiceTotal > 0
              ? Math.round((netTotal / netInvoiceTotal) * actualCollected)
              : 0;

          const sub = await this.subscriptionsService.createFromItem(tx, {
            gymId,
            invoiceId: invoice.id,
            invoiceItemId: invItem.id,
            memberId: dto.memberId,
            plan: pItem.plan,
            netPricePiasters: netTotal,
            allocatedCollectedPiasters: itemAllocatedCollected,
            options: pItem.subscriptionOptions,
            createdById: actorId,
          });
          createdSubscriptions.push(sub);
        } else if (pItem.kind === "PRODUCT") {
          await tx.product.update({
            where: { id: pItem.productId! },
            data: { stock: { decrement: pItem.quantity } },
          });
        }
      }

      // 3. Payments & Allocations
      const createdPayments: any[] = [];
      for (const p of tenderPayments) {
        const paymentRow = await tx.payment.create({
          data: {
            gymId,
            invoiceId: invoice.id,
            shiftId: shift.id,
            method: p.method,
            amount: piastersToDecimal(p.amount),
            reference: p.reference || null,
            receivedById: actorId,
          },
        });
        createdPayments.push(paymentRow);

        if (p.method === "WALLET" && dto.memberId) {
          const updatedWallet = await tx.wallet.update({
            where: { memberId: dto.memberId },
            data: {
              balance: { decrement: piastersToDecimal(p.amount) },
            },
          });
          await tx.walletTransaction.create({
            data: {
              gymId,
              walletId: updatedWallet.id,
              type: "PURCHASE",
              amount: piastersToDecimal(-p.amount),
              balanceAfter: updatedWallet.balance,
              paymentId: paymentRow.id,
              createdById: actorId,
              note: `Invoice #${invoice.number}`,
            },
          });
        }

        // Pro rata allocations across invoice items
        const itemAllocations = allocateProRata(
          p.amount,
          netItemTotals.map((tot) => (tot > 0 ? tot : 1))
        );

        for (let j = 0; j < createdItems.length; j++) {
          const allocAmount = itemAllocations[j];
          if (allocAmount && allocAmount > 0) {
            await tx.paymentAllocation.create({
              data: {
                gymId,
                paymentId: paymentRow.id,
                invoiceItemId: createdItems[j]!.id,
                amount: piastersToDecimal(allocAmount),
                coachId: pricedItems[j]?.subscriptionOptions?.coachId || null,
              },
            });
          }
        }
      }

      // Overpayment credited to wallet
      if (settle.walletCredit > 0 && dto.memberId) {
        const updatedWallet = await tx.wallet.update({
          where: { memberId: dto.memberId },
          data: { balance: { increment: piastersToDecimal(settle.walletCredit) } },
        });

        await tx.walletTransaction.create({
          data: {
            gymId,
            walletId: updatedWallet.id,
            type: "OVERPAYMENT",
            amount: piastersToDecimal(settle.walletCredit),
            balanceAfter: updatedWallet.balance,
            createdById: actorId,
            note: `Change/overpayment on Invoice #${invoice.number}`,
          },
        });
      }

      // Promotion redemption
      if (appliedPromotionId) {
        await tx.promotionRedemption.create({
          data: {
            gymId,
            promotionId: appliedPromotionId,
            invoiceId: invoice.id,
            memberId: dto.memberId || null,
            amount: piastersToDecimal(totalDiscount),
          },
        });
      }

      return {
        ...invoice,
        items: createdItems,
        payments: createdPayments,
        subscriptions: createdSubscriptions,
      };
    });

    if (idempotencyKey) {
      this.idempotencyCache.set(`${gymId}:${idempotencyKey}`, {
        result,
        createdAt: Date.now(),
      });
    }

    await this.auditService.log({
      gymId,
      actorId,
      action: "INVOICE_CREATE",
      entityType: "Invoice",
      entityId: result.id,
      after: {
        number: result.number,
        total: netInvoiceTotal,
        discount: totalDiscount,
      },
    });

    return this.getById(gymId, result.id);
  }

  async list(gymId: string, filters: any = {}) {
    const where: any = { gymId };
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.status) where.status = filters.status;

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true } },
        items: true,
        payments: true,
      },
    });

    return invoices.map((inv) => {
      const total = decimalToPiasters(inv.total);
      const collected = inv.payments.reduce(
        (sum, p) => sum + decimalToPiasters(p.amount),
        0
      );
      const remaining = Math.max(0, total - collected);

      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        member: inv.member,
        subtotal: decimalToPiasters(inv.subtotal),
        discount: decimalToPiasters(inv.discount),
        total,
        collected,
        remaining,
        discountNote: inv.discountNote,
        discountApprovedById: inv.discountApprovedById,
        createdAt: inv.createdAt.toISOString(),
      };
    });
  }

  async getById(gymId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, gymId },
      include: {
        member: { select: { id: true, name: true, phone: true, code: true } },
        items: {
          include: {
            allocations: true,
            subscription: true,
          },
        },
        payments: {
          include: {
            allocations: true,
          },
        },
        promotion: true,
      },
    });

    if (!inv) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Invoice not found",
      });
    }

    const total = decimalToPiasters(inv.total);
    const collected = inv.payments.reduce(
      (sum, p) => sum + decimalToPiasters(p.amount),
      0
    );
    const remaining = Math.max(0, total - collected);

    return {
      id: inv.id,
      number: inv.number,
      status: inv.status,
      member: inv.member,
      subtotal: decimalToPiasters(inv.subtotal),
      discount: decimalToPiasters(inv.discount),
      total,
      collected,
      remaining,
      promotion: inv.promotion ? { id: inv.promotion.id, name: inv.promotion.name } : null,
      discountNote: inv.discountNote,
      discountApprovedById: inv.discountApprovedById,
      items: inv.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        description: it.description,
        quantity: it.quantity,
        unitPrice: decimalToPiasters(it.unitPrice),
        total: decimalToPiasters(it.total),
        subscriptionId: it.subscription?.id || null,
      })),
      payments: inv.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: decimalToPiasters(p.amount),
        reference: p.reference,
        createdAt: p.createdAt.toISOString(),
      })),
      createdAt: inv.createdAt.toISOString(),
    };
  }

  async collectPayment(gymId: string, actorId: string, id: string, dto: CollectPaymentDto) {
    const shift = await this.getOpenShift(gymId, actorId);
    const inv = await this.prisma.invoice.findFirst({
      where: { id, gymId },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!inv) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Invoice not found",
      });
    }

    if (inv.status === "VOID") {
      throw new ConflictException({
        statusCode: 409,
        code: "INVOICE_VOIDED",
        message: "Cannot collect payment on a voided invoice",
      });
    }

    const invoiceTotal = decimalToPiasters(inv.total);
    const alreadyCollected = inv.payments.reduce(
      (sum, p) => sum + decimalToPiasters(p.amount),
      0
    );
    const remainingDue = Math.max(0, invoiceTotal - alreadyCollected);

    const tenderedTotal = dto.payments.reduce((sum, p) => sum + p.amount, 0);
    const settle = settleTender({ due: remainingDue, tendered: tenderedTotal });

    await this.prisma.runInTransaction(async (tx) => {
      for (const p of dto.payments) {
        const paymentRow = await tx.payment.create({
          data: {
            gymId,
            invoiceId: inv.id,
            shiftId: shift.id,
            method: p.method,
            amount: piastersToDecimal(p.amount),
            reference: p.reference || null,
            receivedById: actorId,
          },
        });

        // Allocations across invoice items pro-rata
        const itemTotals = inv.items.map((it) => decimalToPiasters(it.total));
        const allocations = allocateProRata(
          p.amount,
          itemTotals.map((tot) => (tot > 0 ? tot : 1))
        );

        for (let j = 0; j < inv.items.length; j++) {
          const alloc = allocations[j];
          if (alloc && alloc > 0) {
            await tx.paymentAllocation.create({
              data: {
                gymId,
                paymentId: paymentRow.id,
                invoiceItemId: inv.items[j]!.id,
                amount: piastersToDecimal(alloc),
              },
            });
          }
        }
      }

      if (settle.walletCredit > 0 && inv.memberId) {
        const updatedWallet = await tx.wallet.update({
          where: { memberId: inv.memberId },
          data: { balance: { increment: piastersToDecimal(settle.walletCredit) } },
        });
        await tx.walletTransaction.create({
          data: {
            gymId,
            walletId: updatedWallet.id,
            type: "OVERPAYMENT",
            amount: piastersToDecimal(settle.walletCredit),
            balanceAfter: updatedWallet.balance,
            createdById: actorId,
            note: `Change on Invoice #${inv.number}`,
          },
        });
      }

      const totalCollectedNow = alreadyCollected + settle.applied;
      if (totalCollectedNow >= invoiceTotal) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: "PAID" },
        });
      }

      // Recompute affected subscriptions
      const subs = await tx.subscription.findMany({
        where: { invoiceItemId: { in: inv.items.map((i) => i.id) } },
      });
      await this.subscriptionsService.recompute(
        tx,
        subs.map((s) => s.id)
      );
    });

    return this.getById(gymId, id);
  }

  async approveDiscount(gymId: string, actorId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, gymId },
    });

    if (!inv) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Invoice not found",
      });
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { discountApprovedById: actorId },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "DISCOUNT_APPROVE",
      entityType: "Invoice",
      entityId: id,
    });

    return updated;
  }

  async void(gymId: string, actorId: string, id: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        code: "REASON_REQUIRED",
        message: "Void reason is required",
      });
    }

    const shift = await this.getOpenShift(gymId, actorId);
    const inv = await this.prisma.invoice.findFirst({
      where: { id, gymId },
      include: {
        items: { include: { allocations: true } },
        payments: { include: { allocations: true } },
      },
    });

    if (!inv) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Invoice not found",
      });
    }

    if (inv.status === "VOID") {
      throw new ConflictException({
        statusCode: 409,
        code: "ALREADY_VOIDED",
        message: "Invoice is already voided",
      });
    }

    await this.prisma.runInTransaction(async (tx) => {
      // 1. Create negative payment rows reversing all completed payments
      for (const p of inv.payments) {
        const pAmountPiasters = decimalToPiasters(p.amount);
        if (pAmountPiasters <= 0) continue; // skip already negative rows

        const negPayment = await tx.payment.create({
          data: {
            gymId,
            invoiceId: inv.id,
            shiftId: shift.id,
            method: p.method,
            amount: piastersToDecimal(-pAmountPiasters),
            reference: `Void: ${reason}`,
            receivedById: actorId,
          },
        });

        for (const alloc of p.allocations) {
          const allocAmountPiasters = decimalToPiasters(alloc.amount);
          if (allocAmountPiasters > 0) {
            await tx.paymentAllocation.create({
              data: {
                gymId,
                paymentId: negPayment.id,
                invoiceItemId: alloc.invoiceItemId,
                amount: piastersToDecimal(-allocAmountPiasters),
                coachId: alloc.coachId,
              },
            });
          }
        }

        // If payment was WALLET, refund back to member wallet
        if (p.method === "WALLET" && inv.memberId) {
          const updatedWallet = await tx.wallet.update({
            where: { memberId: inv.memberId },
            data: { balance: { increment: p.amount } },
          });
          await tx.walletTransaction.create({
            data: {
              gymId,
              walletId: updatedWallet.id,
              type: "REFUND",
              amount: p.amount,
              balanceAfter: updatedWallet.balance,
              createdById: actorId,
              note: `Void refund for Invoice #${inv.number}`,
            },
          });
        }
      }

      // 2. Restore product stock & cancel subscriptions
      for (const item of inv.items) {
        if (item.kind === "PRODUCT" && item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        } else if (item.kind === "SUBSCRIPTION") {
          await tx.subscription.updateMany({
            where: { invoiceItemId: item.id },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
        }
      }

      // 3. Remove promotion redemption if any
      await tx.promotionRedemption.deleteMany({
        where: { invoiceId: inv.id },
      });

      // 4. Set invoice status to VOID
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: "VOID", voidedAt: new Date(), note: `Voided: ${reason}` },
      });
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "INVOICE_VOID",
      entityType: "Invoice",
      entityId: id,
      after: { reason },
    });

    return { success: true };
  }
}
