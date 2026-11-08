import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationRecipientType } from "@gym/db";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Monitor coach breaks that have exceeded duration limit (every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorBreaks() {
    try {
      const now = new Date();
      const activeBreaks = await this.prisma.coachBreak.findMany({
        where: { status: "ACTIVE" },
        include: { coach: true },
      });

      let overruns = 0;
      for (const brk of activeBreaks) {
        if (!brk.startedAt) continue;
        const diffMinutes = Math.floor((now.getTime() - brk.startedAt.getTime()) / (60 * 1000));
        const limitMinutes = brk.durationMinutes || 20;

        if (diffMinutes > limitMinutes) {
          overruns++;
          await this.notificationsService.createNotification({
            gymId: brk.gymId,
            recipientType: NotificationRecipientType.STAFF,
            recipientId: brk.coachId,
            type: "BREAK_OVERRUN",
            title: "تجاوز وقت الاستراحة",
            body: `كابتن ${brk.coach.name}، لقد تجاوزت مدة الاستراحة المحددة (${limitMinutes} دقيقة) بمقدار ${diffMinutes - limitMinutes} دقيقة.`,
            dedupeKey: `break-overrun:${brk.id}:${Math.floor(diffMinutes / 5)}`,
          });
        }
      }

      if (overruns > 0) {
        this.logger.log(`[breaks.monitor] Detected ${overruns} break overruns`);
      }
      return { overruns };
    } catch (err: any) {
      this.logger.error(`[breaks.monitor] Error: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Auto-end freezes that have reached their endDate (every 5 min)
   */
  @Cron("*/5 * * * *")
  async autoEndFreezes() {
    try {
      const now = new Date();
      const endedFreezes = await this.prisma.subscriptionFreeze.findMany({
        where: {
          endedAt: null,
          plannedEndAt: { lte: now },
        },
      });

      let ended = 0;
      for (const f of endedFreezes) {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscriptionFreeze.update({
            where: { id: f.id },
            data: { endedAt: now },
          });
          await tx.subscription.update({
            where: { id: f.subscriptionId },
            data: { status: "ACTIVE" },
          });
        });
        ended++;
      }

      if (ended > 0) {
        this.logger.log(`[freezes.autoEnd] Ended ${ended} freezes`);
      }
      return { ended };
    } catch (err: any) {
      this.logger.error(`[freezes.autoEnd] Error: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Recompute expiring or overdue subscriptions (hourly)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async recomputeSubscriptions() {
    try {
      const now = new Date();
      // 1. Expire past subscriptions
      const expired = await this.prisma.subscription.updateMany({
        where: {
          status: "ACTIVE",
          endDate: { lt: now },
        },
        data: { status: "EXPIRED" },
      });

      // 2. Suspend overdue subscriptions past dueAfterDays
      const activeSubs = await this.prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          dueAfterDays: { not: null },
        },
        include: {
          invoiceItem: { include: { allocations: true } },
        },
      });

      let suspendedCount = 0;
      for (const s of activeSubs) {
        if (!s.invoiceItem || !s.dueAfterDays) continue;
        const dueDate = new Date(s.startDate.getTime() + s.dueAfterDays * 24 * 3600 * 1000);
        if (dueDate < now) {
          const total = Number(s.invoiceItem.total);
          const collected = s.invoiceItem.allocations.reduce((acc, a) => acc + Number(a.amount), 0);
          if (total > collected) {
            await this.prisma.subscription.update({
              where: { id: s.id },
              data: { status: "SUSPENDED_UNPAID" },
            });
            suspendedCount++;
          }
        }
      }

      if (expired.count > 0 || suspendedCount > 0) {
        this.logger.log(
          `[subscriptions.recomputeAll] Expired: ${expired.count}, Suspended: ${suspendedCount}`
        );
      }
      return { expired: expired.count, suspended: suspendedCount };
    } catch (err: any) {
      this.logger.error(`[subscriptions.recomputeAll] Error: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Check open shifts exceeding 14 hours (every 30 min)
   */
  @Cron("*/30 * * * *")
  async checkShiftsOpenTooLong() {
    try {
      const now = new Date();
      const fourteenHoursAgo = new Date(now.getTime() - 14 * 3600 * 1000);

      const longShifts = await this.prisma.shift.findMany({
        where: {
          status: "OPEN",
          openedAt: { lte: fourteenHoursAgo },
        },
        include: { staff: true },
      });

      let alerted = 0;
      for (const s of longShifts) {
        alerted++;
        await this.notificationsService.createNotification({
          gymId: s.gymId,
          recipientType: NotificationRecipientType.ADMIN_BROADCAST,
          recipientId: s.gymId,
          type: "SHIFT_OPEN_TOO_LONG",
          title: "وردية مفتوحة لفترة طويلة جداً",
          body: `الوردية الخاصة بالموظف ${s.staff.name} مفتوحة منذ أكثر من 14 ساعة دون إقفال.`,
          dedupeKey: `shift-long:${s.id}:${now.toISOString().slice(0, 13)}`,
        });
      }

      if (alerted > 0) {
        this.logger.log(`[shifts.openTooLong] Alerted ${alerted} open shifts`);
      }
      return { alerted };
    } catch (err: any) {
      this.logger.error(`[shifts.openTooLong] Error: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Mark due milestones as EARNED (daily 00:10)
   */
  @Cron("10 0 * * *")
  async markCommissionEarned() {
    try {
      const now = new Date();
      const dueMilestones = await this.prisma.commissionEntry.updateMany({
        where: {
          status: "PENDING",
          dueDate: { lte: now },
        },
        data: {
          status: "EARNED",
        },
      });

      if (dueMilestones.count > 0) {
        this.logger.log(`[commission.markEarned] Marked ${dueMilestones.count} milestones as EARNED`);
      }
      return { markedEarned: dueMilestones.count };
    } catch (err: any) {
      this.logger.error(`[commission.markEarned] Error: ${err.message}`);
      return { error: err.message };
    }
  }
}
