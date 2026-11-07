import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { canInviteVisitor } from "@gym/domain";
import type {
  CreateVisitorDto,
  CheckInVisitorDto,
} from "@gym/contracts";

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async searchVisitors(gymId: string, query?: string) {
    return this.prisma.visitor.findMany({
      where: {
        gymId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { phone: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async createVisitor(gymId: string, actorId: string, dto: CreateVisitorDto) {
    const existing = await this.prisma.visitor.findFirst({
      where: { gymId, phone: dto.phone },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: "PHONE_ALREADY_EXISTS",
        message: `Visitor with phone ${dto.phone} already exists`,
      });
    }

    const visitor = await this.prisma.visitor.create({
      data: {
        gymId,
        name: dto.name,
        phone: dto.phone,
        notes: dto.notes || null,
      },
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "VISITOR_CREATE",
      entityType: "Visitor",
      entityId: visitor.id,
      after: visitor,
    });

    return visitor;
  }

  async checkInVisitor(gymId: string, actorId: string, dto: CheckInVisitorDto) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id: dto.visitorId, gymId },
    });
    if (!visitor) {
      throw new NotFoundException({
        statusCode: 404,
        code: "VISITOR_NOT_FOUND",
        message: `Visitor ${dto.visitorId} not found`,
      });
    }

    const member = await this.prisma.member.findFirst({
      where: { id: dto.invitedByMemberId, gymId },
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { endDate: "desc" },
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        statusCode: 404,
        code: "MEMBER_NOT_FOUND",
        message: `Inviting member ${dto.invitedByMemberId} not found`,
      });
    }

    // Select the specified subscription or the active subscription with invitations
    let subscription = dto.subscriptionId
      ? member.subscriptions.find((s) => s.id === dto.subscriptionId)
      : member.subscriptions.find((s) => s.usedInvitations < s.maxInvitations);

    if (!subscription && member.subscriptions.length > 0) {
      subscription = member.subscriptions[0];
    }

    if (!subscription) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "Inviting member has no active subscription",
      });
    }

    // Evaluate usability
    const subscriptionUsable = subscription.status === "ACTIVE";

    const check = canInviteVisitor({
      subscriptionUsable,
      maxInvitations: subscription.maxInvitations,
      usedInvitations: subscription.usedInvitations,
    });

    if (check !== "OK") {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: check,
        message: `Visitor check-in denied: ${check}`,
      });
    }

    const attendance = await this.prisma.runInTransaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          usedInvitations: subscription.usedInvitations + 1,
        },
      });

      return tx.visitorAttendance.create({
        data: {
          gymId,
          visitorId: visitor.id,
          invitedByMemberId: member.id,
          subscriptionId: subscription.id,
        },
      });
    });

    await this.auditService.log({
      gymId,
      actorId,
      action: "VISITOR_CHECK_IN",
      entityType: "VisitorAttendance",
      entityId: attendance.id,
      after: {
        visitorId: visitor.id,
        memberId: member.id,
        subscriptionId: subscription.id,
      },
    });

    return attendance;
  }

  async getVisitorById(gymId: string, id: string) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, gymId },
      include: {
        attendances: {
          include: {
            invitedBy: {
              select: { id: true, code: true, name: true, phone: true },
            },
            subscription: {
              select: { id: true, kind: true },
            },
          },
          orderBy: { checkInAt: "desc" },
        },
      },
    });

    if (!visitor) {
      throw new NotFoundException({
        statusCode: 404,
        code: "VISITOR_NOT_FOUND",
        message: `Visitor ${id} not found`,
      });
    }

    return visitor;
  }
}
