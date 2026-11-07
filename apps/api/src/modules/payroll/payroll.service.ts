import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import {
  toMinor,
  fromMinor,
  pickTier,
  monthlyCommission,
  percentOf,
  bpsOf,
  type Tier,
} from "@gym/domain";
import {
  PayrollStatus,
  PayrollLineKind,
  CommissionEntryStatus,
  StaffRole,
} from "@gym/db";
import type { AddPayrollLineDto } from "@gym/contracts";

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionsService: CommissionsService
  ) {}

  /**
   * List all payroll runs for a gym.
   */
  async listRuns(gymId: string) {
    return this.prisma.payrollRun.findMany({
      where: { gymId },
      include: {
        lines: true,
        _count: { select: { lines: true, entries: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  /**
   * Get single payroll run with lines grouped by staff.
   */
  async getRun(gymId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, gymId },
      include: {
        lines: {
          include: {
            staff: { select: { id: true, name: true, role: true, email: true } },
          },
          orderBy: { amount: "desc" },
        },
        entries: {
          include: {
            coach: { select: { id: true, name: true } },
            subscription: {
              include: {
                member: { select: { id: true, name: true, code: true } },
                plan: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException({
        statusCode: 404,
        code: "RUN_NOT_FOUND",
        message: `Payroll run ${runId} not found`,
      });
    }

    // Group lines by staff
    const staffMap = new Map<string, { staff: any; lines: any[]; netTotal: number }>();

    for (const line of run.lines) {
      if (!staffMap.has(line.staffId)) {
        staffMap.set(line.staffId, {
          staff: line.staff,
          lines: [],
          netTotal: 0,
        });
      }
      const record = staffMap.get(line.staffId)!;
      record.lines.push(line);
      const val = Number(line.amount);
      if (line.kind === PayrollLineKind.DEDUCTION) {
        record.netTotal -= Math.abs(val);
      } else {
        record.netTotal += val;
      }
    }

    const staffSummary = Array.from(staffMap.values());

    return {
      id: run.id,
      gymId: run.gymId,
      year: run.year,
      month: run.month,
      status: run.status,
      closedAt: run.closedAt?.toISOString() || null,
      closedById: run.closedById,
      createdAt: run.createdAt.toISOString(),
      run,
      staff: staffSummary.map((s) => ({
        staffId: s.staff.id,
        staff: s.staff,
        lines: s.lines.map((l) => ({
          id: l.id,
          kind: l.kind,
          amount: Number(l.amount),
          description: l.description,
          collectedRevenue: l.collectedRevenue !== null ? Number(l.collectedRevenue) : null,
          tierPercent: l.tierPercent !== null ? Number(l.tierPercent) : null,
        })),
        netTotal: s.netTotal,
      })),
      staffSummary,
      totalPayout: staffSummary.reduce((sum, s) => sum + s.netTotal, 0),
    };
  }

  /**
   * Create a new payroll run (draft).
   */
  async createRun(gymId: string, actorId: string, year: number, month: number) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: {
        gymId_year_month: { gymId, year, month },
      },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: "RUN_EXISTS",
        message: `Payroll run for ${year}/${month} already exists`,
      });
    }

    const run = await this.prisma.payrollRun.create({
      data: {
        gymId,
        year,
        month,
        status: PayrollStatus.DRAFT,
      },
    });

    await this.calculateLines(gymId, run.id);

    return this.getRun(gymId, run.id);
  }

  /**
   * Recalculate draft payroll run.
   */
  async recalculateRun(gymId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, gymId },
    });

    if (!run) {
      throw new NotFoundException({
        statusCode: 404,
        code: "RUN_NOT_FOUND",
        message: `Payroll run ${runId} not found`,
      });
    }

    if (run.status === PayrollStatus.CLOSED) {
      throw new BadRequestException({
        statusCode: 400,
        code: "RUN_CLOSED",
        message: "Closed payroll runs cannot be recalculated",
      });
    }

    await this.calculateLines(gymId, run.id);

    return this.getRun(gymId, run.id);
  }

  /**
   * Core calculation: lines for active staff.
   */
  private async calculateLines(gymId: string, runId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
    });
    if (!run) return;

    const { year, month } = run;
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Remove old auto lines (BASE_SALARY, COMMISSION, ADJUSTMENT)
    await this.prisma.payrollLine.deleteMany({
      where: {
        payrollRunId: runId,
        kind: { in: [PayrollLineKind.BASE_SALARY, PayrollLineKind.COMMISSION, PayrollLineKind.ADJUSTMENT] },
      },
    });

    // Active staff members (excluding super admin)
    const staffList = await this.prisma.staff.findMany({
      where: {
        gymId,
        isActive: true,
        role: { not: StaffRole.SUPER_ADMIN },
      },
    });

    for (const staff of staffList) {
      // 1. BASE_SALARY
      const baseSalary = Number(staff.baseSalary || 0);
      if (baseSalary > 0) {
        await this.prisma.payrollLine.create({
          data: {
            payrollRunId: runId,
            staffId: staff.id,
            kind: PayrollLineKind.BASE_SALARY,
            amount: baseSalary,
            description: `الراتب الأساسي لشهر ${month}/${year}`,
          },
        });
      }

      // 2. If COACH: calculate Commission and Adjustments
      if (staff.role === StaffRole.COACH) {
        // Collected revenue in the month
        const allocations = await this.prisma.paymentAllocation.findMany({
          where: {
            gymId,
            coachId: staff.id,
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        });

        const collectedMinor = allocations.reduce(
          (sum, a) => sum + toMinor(Number(a.amount)),
          0
        );

        const rawTiers = await this.commissionsService.getTiers(gymId, staff.id);
        const domainTiers: Tier[] = rawTiers.map((t) => ({
          minRevenue: toMinor(t.minRevenue),
          percent: t.percent,
        }));

        if (domainTiers.length === 0) {
          throw new BadRequestException({
            statusCode: 400,
            code: "NO_TIERS_CONFIGURED",
            message: `No commission tiers configured for gym or coach ${staff.name}`,
          });
        }

        const tier = pickTier(domainTiers, collectedMinor);

        // Eligible entries: dueDate <= monthEnd, status != VOID, payrollRunId == null
        const entries = await this.prisma.commissionEntry.findMany({
          where: {
            gymId,
            coachId: staff.id,
            status: { not: CommissionEntryStatus.VOID },
            payrollRunId: null,
            dueDate: { lte: monthEnd },
          },
        });

        const domainEntries = entries.map((e) => ({
          allocatedBase: toMinor(Number(e.allocatedBase)),
          shareBps: e.shareBps,
        }));

        const result = monthlyCommission({
          entries: domainEntries,
          tier,
        });

        if (entries.length > 0) {
          await this.prisma.payrollLine.create({
            data: {
              payrollRunId: runId,
              staffId: staff.id,
              kind: PayrollLineKind.COMMISSION,
              amount: fromMinor(result.commission),
              collectedRevenue: fromMinor(collectedMinor),
              tierPercent: tier.percent,
              description: `عمولة تدريب شخصي PT (إيراد محصل: ${fromMinor(collectedMinor)} ج.م - شريحة: ${tier.percent}%)`,
            },
          });
        }

        // 3. Adjustments for past PAID entries where allocatedBase changed (late payment or refund)
        const pastPaidEntries = await this.prisma.commissionEntry.findMany({
          where: {
            gymId,
            coachId: staff.id,
            status: CommissionEntryStatus.PAID,
            payrollRunId: { not: null, notIn: [runId] },
          },
        });

        for (const pe of pastPaidEntries) {
          if (pe.tierPercent === null || pe.amount === null) continue;
          const currentExpectedMinor = percentOf(
            bpsOf(toMinor(Number(pe.allocatedBase)), pe.shareBps),
            Number(pe.tierPercent)
          );
          const frozenMinor = toMinor(Number(pe.amount));
          const diffMinor = currentExpectedMinor - frozenMinor;

          if (diffMinor !== 0) {
            await this.prisma.payrollLine.create({
              data: {
                payrollRunId: runId,
                staffId: staff.id,
                kind: PayrollLineKind.ADJUSTMENT,
                amount: fromMinor(diffMinor),
                description: `تسوية عمولة محصلة لاحقاً/مرتجع لاشتراك #${pe.subscriptionId} (محطة ${pe.milestoneIndex})`,
              },
            });
          }
        }
      }
    }
  }

  /**
   * Add manual BONUS or DEDUCTION line to draft run.
   */
  async addLine(gymId: string, runId: string, dto: AddPayrollLineDto) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, gymId },
    });

    if (!run) {
      throw new NotFoundException({
        statusCode: 404,
        code: "RUN_NOT_FOUND",
        message: `Payroll run ${runId} not found`,
      });
    }

    if (run.status === PayrollStatus.CLOSED) {
      throw new BadRequestException({
        statusCode: 400,
        code: "RUN_CLOSED",
        message: "Cannot add lines to a closed payroll run",
      });
    }

    return this.prisma.payrollLine.create({
      data: {
        payrollRunId: runId,
        staffId: dto.staffId,
        kind: dto.kind === "BONUS" ? PayrollLineKind.BONUS : PayrollLineKind.DEDUCTION,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  /**
   * Delete manual line from draft run.
   */
  async deleteLine(gymId: string, runId: string, lineId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, gymId },
    });

    if (!run || run.status === PayrollStatus.CLOSED) {
      throw new BadRequestException({
        statusCode: 400,
        code: "RUN_CLOSED",
        message: "Cannot delete lines from a closed payroll run",
      });
    }

    return this.prisma.payrollLine.delete({
      where: { id: lineId },
    });
  }

  /**
   * Close and lock payroll run. Freezes entries.
   */
  async closeRun(gymId: string, actorId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, gymId },
    });

    if (!run) {
      throw new NotFoundException({
        statusCode: 404,
        code: "RUN_NOT_FOUND",
        message: `Payroll run ${runId} not found`,
      });
    }

    if (run.status === PayrollStatus.CLOSED) {
      throw new BadRequestException({
        statusCode: 400,
        code: "RUN_ALREADY_CLOSED",
        message: "Payroll run is already closed",
      });
    }

    // Check if an earlier month is still DRAFT
    const openEarlier = await this.prisma.payrollRun.findFirst({
      where: {
        gymId,
        status: PayrollStatus.DRAFT,
        OR: [
          { year: { lt: run.year } },
          { year: run.year, month: { lt: run.month } },
        ],
      },
    });

    if (openEarlier) {
      throw new BadRequestException({
        statusCode: 400,
        code: "PREVIOUS_RUN_OPEN",
        message: `Cannot close ${run.year}/${run.month} while earlier month ${openEarlier.year}/${openEarlier.month} is still open`,
      });
    }

    // Recalculate once more to guarantee exact numbers
    await this.calculateLines(gymId, run.id);

    const { year, month } = run;
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    return this.prisma.$transaction(async (tx) => {
      // Find all coaches with commission lines
      const commissionLines = await tx.payrollLine.findMany({
        where: { payrollRunId: run.id, kind: PayrollLineKind.COMMISSION },
      });

      for (const line of commissionLines) {
        const coachId = line.staffId;
        const tierPercent = Number(line.tierPercent || 0);

        // Find entries included
        const entries = await tx.commissionEntry.findMany({
          where: {
            gymId,
            coachId,
            payrollRunId: null,
            status: { not: CommissionEntryStatus.VOID },
            dueDate: { lte: monthEnd },
          },
        });

        for (const entry of entries) {
          const entryAmountMinor = percentOf(
            bpsOf(toMinor(Number(entry.allocatedBase)), entry.shareBps),
            tierPercent
          );

          await tx.commissionEntry.update({
            where: { id: entry.id },
            data: {
              status: CommissionEntryStatus.PAID,
              tierPercent,
              amount: fromMinor(entryAmountMinor),
              payrollRunId: run.id,
            },
          });
        }
      }

      // Update past paid entries that had adjustments
      const adjustmentLines = await tx.payrollLine.findMany({
        where: { payrollRunId: run.id, kind: PayrollLineKind.ADJUSTMENT },
      });

      for (const adj of adjustmentLines) {
        const pastEntries = await tx.commissionEntry.findMany({
          where: {
            gymId,
            coachId: adj.staffId,
            status: CommissionEntryStatus.PAID,
            payrollRunId: { not: null, notIn: [run.id] },
          },
        });

        for (const pe of pastEntries) {
          if (pe.tierPercent === null || pe.amount === null) continue;
          const currentExpectedMinor = percentOf(
            bpsOf(toMinor(Number(pe.allocatedBase)), pe.shareBps),
            Number(pe.tierPercent)
          );
          await tx.commissionEntry.update({
            where: { id: pe.id },
            data: { amount: fromMinor(currentExpectedMinor) },
          });
        }
      }

      // Close the run
      const closed = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollStatus.CLOSED,
          closedAt: new Date(),
          closedById: actorId,
        },
      });

      return closed;
    });
  }
}
