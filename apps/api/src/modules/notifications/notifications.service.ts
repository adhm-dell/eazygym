import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationRecipientType } from "@gym/db";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(gymId: string, recipientId: string, role?: string) {
    const isStaffAdmin = role === "GYM_ADMIN" || role === "SUPER_ADMIN";

    const whereClause: any = {
      gymId,
      OR: [
        { recipientId },
        ...(isStaffAdmin ? [{ recipientType: NotificationRecipientType.ADMIN_BROADCAST }] : []),
      ],
    };

    const notifications = await this.prisma.notification.findMany({
      where: whereClause,
      include: {
        reads: { where: { readerId: recipientId } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = notifications.map((n) => {
      const isRead = n.recipientType === NotificationRecipientType.ADMIN_BROADCAST
        ? n.reads.length > 0
        : n.readAt !== null;

      return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        isRead,
      };
    });

    const unreadCount = items.filter((i) => !i.isRead).length;

    return {
      unreadCount,
      items,
    };
  }

  async markRead(gymId: string, recipientId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, gymId },
    });

    if (!notification) return { success: false };

    if (notification.recipientType === NotificationRecipientType.ADMIN_BROADCAST) {
      await this.prisma.notificationRead.upsert({
        where: {
          notificationId_readerId: { notificationId, readerId: recipientId },
        },
        update: {},
        create: {
          notificationId,
          readerId: recipientId,
        },
      });
    } else {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return { success: true };
  }

  async markAllRead(gymId: string, recipientId: string, role?: string) {
    const isStaffAdmin = role === "GYM_ADMIN" || role === "SUPER_ADMIN";

    if (isStaffAdmin) {
      const adminBroadcasts = await this.prisma.notification.findMany({
        where: {
          gymId,
          recipientType: NotificationRecipientType.ADMIN_BROADCAST,
        },
        select: { id: true },
      });

      for (const b of adminBroadcasts) {
        await this.prisma.notificationRead.upsert({
          where: { notificationId_readerId: { notificationId: b.id, readerId: recipientId } },
          update: {},
          create: { notificationId: b.id, readerId: recipientId },
        });
      }
    }

    await this.prisma.notification.updateMany({
      where: { gymId, recipientId, readAt: null },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async createNotification(data: {
    gymId: string;
    recipientType: NotificationRecipientType;
    recipientId: string;
    type: string;
    title: string;
    body: string;
    dedupeKey?: string;
  }) {
    if (data.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          gymId: data.gymId,
          recipientId: data.recipientId,
          dedupeKey: data.dedupeKey || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.notification.create({
      data: {
        gymId: data.gymId,
        recipientType: data.recipientType,
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        body: data.body,
        dedupeKey: data.dedupeKey || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      },
    });
  }
}
