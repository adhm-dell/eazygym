import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface SetupStatusResponse {
  isComplete: boolean;
  plans: boolean;
  services: boolean;
  reception: boolean;
  coaches: boolean;
  coachShifts: boolean;
  commissionTiers: boolean;
  paymentPolicy: boolean;
  classes: boolean;
  counts: {
    plans: number;
    services: number;
    reception: number;
    coaches: number;
    coachesWithoutShifts: number;
    commissionTiers: number;
    classes: number;
  };
  completedSteps: number;
  totalRequiredSteps: number;
}

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(gymId: string): Promise<SetupStatusResponse> {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { defaultMinUpfrontPercent: true, defaultDueAfterDays: true },
    });

    const activePlansCount = await this.prisma.plan.count({
      where: { gymId, isActive: true },
    });

    const activeServicesCount = await this.prisma.service.count({
      where: { gymId, isActive: true },
    });

    const receptionCount = await this.prisma.staff.count({
      where: { gymId, role: "RECEPTION", isActive: true },
    });

    const activeCoaches = await this.prisma.staff.findMany({
      where: { gymId, role: "COACH", isActive: true },
      select: { id: true },
    });
    const coachesCount = activeCoaches.length;

    let coachesWithoutShiftsCount = 0;
    if (coachesCount > 0) {
      const coachIds = activeCoaches.map((c) => c.id);
      const shifts = await this.prisma.coachShift.findMany({
        where: { gymId, coachId: { in: coachIds }, isActive: true },
        select: { coachId: true },
      });
      const coachesWithShifts = new Set(shifts.map((s) => s.coachId));
      coachesWithoutShiftsCount = coachIds.filter((id) => !coachesWithShifts.has(id)).length;
    }

    const tiers = await this.prisma.commissionTier.findMany({
      where: { gymId, coachId: null },
    });
    const hasZeroTier = tiers.some((t) => Number(t.minRevenue) === 0);

    const activeClassesCount = await this.prisma.classSchedule.count({
      where: { gymId, isActive: true },
    });

    const isPlansReady = activePlansCount >= 1;
    const isReceptionReady = receptionCount >= 1;
    const isCoachesReady = coachesCount >= 1;
    const isCoachShiftsReady = coachesCount > 0 && coachesWithoutShiftsCount === 0;
    const isCommissionTiersReady = tiers.length > 0 && hasZeroTier;
    const isPaymentPolicyReady = gym !== null && gym.defaultMinUpfrontPercent !== null && gym.defaultDueAfterDays !== null;

    const requiredFlags = [
      isPlansReady,
      isReceptionReady,
      isCoachesReady,
      isCoachShiftsReady,
      isCommissionTiersReady,
      isPaymentPolicyReady,
    ];

    const completedSteps = requiredFlags.filter(Boolean).length;
    const isComplete = completedSteps === requiredFlags.length;

    return {
      isComplete,
      plans: isPlansReady,
      services: activeServicesCount > 0,
      reception: isReceptionReady,
      coaches: isCoachesReady,
      coachShifts: isCoachShiftsReady,
      commissionTiers: isCommissionTiersReady,
      paymentPolicy: isPaymentPolicyReady,
      classes: activeClassesCount > 0,
      counts: {
        plans: activePlansCount,
        services: activeServicesCount,
        reception: receptionCount,
        coaches: coachesCount,
        coachesWithoutShifts: coachesWithoutShiftsCount,
        commissionTiers: tiers.length,
        classes: activeClassesCount,
      },
      completedSteps,
      totalRequiredSteps: requiredFlags.length,
    };
  }
}
