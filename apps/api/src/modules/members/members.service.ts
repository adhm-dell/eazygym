import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { NumberingService } from "../numbering/numbering.service";
import { evaluateAccess, type AccessSubscription, isOverdue } from "@gym/domain";
import { decimalToPiasters } from "@gym/db";
import type {
  CreateMemberDto,
  UpdateMemberDto,
  BlockMemberDto,
  SetMemberPasswordDto,
} from "@gym/contracts";

export interface MemberListQuery {
  gymId: string;
  userRole?: string;
  userId?: string;
  search?: string;
  status?: string;
  planKind?: string;
  coachId?: string;
  expiringInDays?: number;
  overdue?: boolean;
  blocked?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly numberingService: NumberingService
  ) {}

  async list(params: MemberListQuery) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      gymId: params.gymId,
    };

    // If COACH, limit to assigned trainees
    if (params.userRole === "COACH" && params.userId) {
      where.OR = [
        { coachTrainees: { some: { coachId: params.userId } } },
        { subscriptions: { some: { assignments: { some: { coachId: params.userId, toDate: null } } } } },
      ];
    }

    if (params.blocked !== undefined) {
      where.isBlocked = params.blocked;
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { code: { contains: q } },
      ];
    }

    if (params.coachId) {
      where.subscriptions = {
        some: {
          assignments: {
            some: { coachId: params.coachId, toDate: null },
          },
        },
      };
    }

    if (params.planKind) {
      where.subscriptions = {
        some: {
          plan: { kind: params.planKind as any },
          status: { in: ["ACTIVE", "PENDING_PAYMENT", "FROZEN"] },
        },
      };
    }

    const [members, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          wallet: true,
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    const memberIds = members.map((m) => m.id);

    // Batch load subscriptions for these members (No N+1)
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        memberId: { in: memberIds },
        gymId: params.gymId,
      },
      include: {
        plan: true,
        freezes: { where: { endedAt: null } },
        invoiceItem: {
          include: {
            allocations: true,
          },
        },
      },
    });

    const now = new Date();
    const subsByMember = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const list = subsByMember.get(sub.memberId) || [];
      list.push(sub);
      subsByMember.set(sub.memberId, list);
    }

    const items = members.map((member) => {
      const memberSubs = subsByMember.get(member.id) || [];

      const accessSubs: AccessSubscription[] = memberSubs.map((s) => {
        const totalAmount = decimalToPiasters(s.price);
        const collected = (s.invoiceItem?.allocations || []).reduce(
          (sum: number, alloc) => sum + decimalToPiasters(alloc.amount),
          0
        );

        const isSubOverdue = isOverdue({
          total: totalAmount,
          collected,
          startDate: s.startDate,
          durationDays: s.plan.durationDays,
          now,
          dueAfterDays: s.dueAfterDays !== null ? s.dueAfterDays : s.plan.dueAfterDays,
          dueAfterPercent:
            s.dueAfterPercent !== null
              ? Number(s.dueAfterPercent)
              : s.plan.dueAfterPercent
              ? Number(s.plan.dueAfterPercent)
              : undefined,
        });

        const activeFreeze = s.freezes.length > 0;
        const sessionsLeft =
          s.totalSessions !== null ? Math.max(0, s.totalSessions - s.usedSessions) : null;

        return {
          id: s.id,
          kind: s.plan.kind as any,
          grantsFloorAccess: s.plan.grantsFloorAccess,
          startDate: s.startDate,
          endDate: s.endDate,
          cancelled: s.status === "CANCELLED",
          activated: s.status !== "PENDING_PAYMENT",
          frozen: activeFreeze || s.status === "FROZEN",
          overdue: isSubOverdue || s.status === "SUSPENDED_UNPAID",
          sessionsLeft,
        };
      });

      const decision = evaluateAccess(
        { isBlocked: member.isBlocked, subscriptions: accessSubs },
        now
      );

      const activeSub = memberSubs.find(
        (s) => s.status === "ACTIVE" || s.status === "FROZEN" || s.status === "PENDING_PAYMENT"
      );

      return {
        id: member.id,
        gymId: member.gymId,
        code: member.code,
        name: member.name,
        phone: member.phone,
        email: member.email,
        gender: member.gender,
        birthDate: member.birthDate ? member.birthDate.toISOString().split("T")[0] : null,
        notes: member.notes,
        isBlocked: member.isBlocked,
        blockedReason: member.blockedReason,
        status: decision.reason,
        activePlanName: activeSub?.plan?.name || null,
        activePlanKind: activeSub?.plan?.kind || null,
        daysLeft: decision.daysLeft ?? null,
        walletBalance: member.wallet ? decimalToPiasters(member.wallet.balance) : 0,
        createdAt: member.createdAt.toISOString(),
      };
    });

    let filteredItems = items;
    if (params.status) {
      filteredItems = filteredItems.filter((i) => i.status === params.status);
    }
    if (params.overdue) {
      filteredItems = filteredItems.filter((i) => i.status === "PAYMENT_OVERDUE");
    }

    return {
      items: filteredItems,
      total,
      page,
      limit,
    };
  }

  async getById(gymId: string, memberId: string, requester: { id: string; role: string }) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        wallet: true,
        coachTrainees: {
          select: { coachId: true },
        },
        subscriptions: {
          include: {
            plan: true,
            freezes: true,
            assignments: {
              include: { coach: { select: { id: true, name: true } } },
            },
            invoiceItem: {
              include: {
                allocations: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Cross-tenant: must return 404 (not 403)
    if (!member || member.gymId !== gymId) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    // Role-based access enforcement
    if (requester.role === "MEMBER" && requester.id !== member.id) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Members can only view their own profile",
      });
    }

    if (requester.role === "COACH") {
      const isDirectTrainee = member.coachTrainees.some((t) => t.coachId === requester.id);
      const isAssignedCoach = member.subscriptions.some((s) =>
        s.assignments.some((ca) => ca.coachId === requester.id && ca.toDate === null)
      );
      if (!isDirectTrainee && !isAssignedCoach) {
        throw new ForbiddenException({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Coaches may only view their assigned trainees",
        });
      }
    }

    const now = new Date();
    const accessSubs: AccessSubscription[] = member.subscriptions.map((s) => {
      const totalAmount = decimalToPiasters(s.price);
      const collected = (s.invoiceItem?.allocations || []).reduce(
        (sum: number, alloc) => sum + decimalToPiasters(alloc.amount),
        0
      );

      const isSubOverdue = isOverdue({
        total: totalAmount,
        collected,
        startDate: s.startDate,
        durationDays: s.plan.durationDays,
        now,
        dueAfterDays: s.dueAfterDays !== null ? s.dueAfterDays : s.plan.dueAfterDays,
        dueAfterPercent:
          s.dueAfterPercent !== null
            ? Number(s.dueAfterPercent)
            : s.plan.dueAfterPercent
            ? Number(s.plan.dueAfterPercent)
            : undefined,
      });

      const sessionsLeft =
        s.totalSessions !== null ? Math.max(0, s.totalSessions - s.usedSessions) : null;

      return {
        id: s.id,
        kind: s.plan.kind as any,
        grantsFloorAccess: s.plan.grantsFloorAccess,
        startDate: s.startDate,
        endDate: s.endDate,
        cancelled: s.status === "CANCELLED",
        activated: s.status !== "PENDING_PAYMENT",
        frozen: s.freezes.some((f) => f.endedAt === null) || s.status === "FROZEN",
        overdue: isSubOverdue || s.status === "SUSPENDED_UNPAID",
        sessionsLeft,
      };
    });

    const accessDecision = evaluateAccess(
      { isBlocked: member.isBlocked, subscriptions: accessSubs },
      now
    );

    // Calculate total remaining balance
    let remainingBalance = 0;
    for (const sub of member.subscriptions) {
      const total = decimalToPiasters(sub.price);
      const collected = (sub.invoiceItem?.allocations || []).reduce(
        (sum: number, alloc) => sum + decimalToPiasters(alloc.amount),
        0
      );
      const diff = Math.max(0, total - collected);
      remainingBalance += diff;
    }

    return {
      id: member.id,
      gymId: member.gymId,
      code: member.code,
      name: member.name,
      phone: member.phone,
      email: member.email,
      gender: member.gender,
      birthDate: member.birthDate ? member.birthDate.toISOString().split("T")[0] : null,
      notes: member.notes,
      isBlocked: member.isBlocked,
      blockedReason: member.blockedReason,
      status: accessDecision.reason,
      walletBalance: member.wallet ? decimalToPiasters(member.wallet.balance) : 0,
      remainingBalance,
      subscriptions: member.subscriptions.map((s) => ({
        id: s.id,
        planId: s.planId,
        planName: s.plan.name,
        kind: s.plan.kind,
        status: s.status,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        price: decimalToPiasters(s.price),
        sessionsLeft: s.totalSessions !== null ? Math.max(0, s.totalSessions - s.usedSessions) : null,
        totalSessions: s.totalSessions,
        activeCoach: s.assignments.find((ca) => ca.toDate === null)?.coach || null,
        freezes: s.freezes,
      })),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  async create(gymId: string, actorId: string, dto: CreateMemberDto) {
    const phone = dto.phone.trim();

    // Check duplicate phone in gym
    const existing = await this.prisma.member.findUnique({
      where: {
        gymId_phone: {
          gymId,
          phone,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: "PHONE_EXISTS",
        message: "A member with this phone number already exists in this gym",
      });
    }

    const code = await this.numberingService.generateMemberCode(gymId);
    const initialPasswordHash = await this.authService.hashPassword(code);

    const result = await this.prisma.runInTransaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          gymId,
          code,
          passwordHash: initialPasswordHash,
          name: dto.name,
          phone,
          email: dto.email || null,
          gender: dto.gender || null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          notes: dto.notes || null,
        },
      });

      await tx.wallet.create({
        data: {
          gymId,
          memberId: member.id,
          balance: 0,
        },
      });

      return member;
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "MEMBER_CREATE",
      entityType: "Member",
      entityId: result.id,
      after: {
        code: result.code,
        name: result.name,
        phone: result.phone,
      },
    });

    return {
      id: result.id,
      gymId: result.gymId,
      code: result.code,
      name: result.name,
      phone: result.phone,
      email: result.email,
      gender: result.gender,
      birthDate: result.birthDate ? result.birthDate.toISOString().split("T")[0] : null,
      notes: result.notes,
      isBlocked: result.isBlocked,
      blockedReason: result.blockedReason,
      status: "NO_SUBSCRIPTION",
      walletBalance: 0,
      createdAt: result.createdAt.toISOString(),
    };
  }

  async update(gymId: string, actorId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    if (dto.phone && dto.phone.trim() !== member.phone) {
      const existing = await this.prisma.member.findUnique({
        where: {
          gymId_phone: {
            gymId,
            phone: dto.phone.trim(),
          },
        },
      });
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          code: "PHONE_EXISTS",
          message: "A member with this phone number already exists in this gym",
        });
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data,
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "MEMBER_UPDATE",
      entityType: "Member",
      entityId: updated.id,
      before: member,
      after: updated,
    });

    return updated;
  }

  async block(gymId: string, actorId: string, memberId: string, dto: BlockMemberDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        code: "REASON_REQUIRED",
        message: "Block reason is required",
      });
    }

    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: {
        isBlocked: true,
        blockedReason: dto.reason.trim(),
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "MEMBER_BLOCK",
      entityType: "Member",
      entityId: updated.id,
      before: { isBlocked: member.isBlocked, blockedReason: member.blockedReason },
      after: { isBlocked: updated.isBlocked, blockedReason: updated.blockedReason },
    });

    return updated;
  }

  async unblock(gymId: string, actorId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: {
        isBlocked: false,
        blockedReason: null,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "MEMBER_UNBLOCK",
      entityType: "Member",
      entityId: updated.id,
      before: { isBlocked: member.isBlocked, blockedReason: member.blockedReason },
      after: { isBlocked: updated.isBlocked, blockedReason: null },
    });

    return updated;
  }

  async setPassword(gymId: string, actorId: string, memberId: string, dto: SetMemberPasswordDto) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    const passwordHash = await this.authService.hashPassword(dto.password);

    await this.prisma.member.update({
      where: { id: memberId },
      data: { passwordHash },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "MEMBER_SET_PASSWORD",
      entityType: "Member",
      entityId: memberId,
    });

    return { success: true };
  }

  async getWallet(gymId: string, memberId: string, requester: { id: string; role: string }) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    if (requester.role === "MEMBER" && requester.id !== member.id) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "Members can only view their own wallet",
      });
    }

    const wallet = member.wallet;
    if (!wallet) {
      return {
        balance: 0,
        transactions: [],
      };
    }

    return {
      balance: decimalToPiasters(wallet.balance),
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: decimalToPiasters(t.amount),
        balanceAfter: decimalToPiasters(t.balanceAfter),
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }
}
