import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCoachShiftDto, UpdateCoachShiftDto, CreateCoachWeeklyScheduleDto } from "@gym/contracts";
import { isOnShift, coachIdsOnShift, parseHHMM, type CoachShiftRow } from "@gym/domain";

@Injectable()
export class CoachShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateTime(timeStr: string) {
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      throw new BadRequestException(`Invalid time format '${timeStr}'. Expected HH:MM`);
    }
    const [hh, mm] = timeStr.split(":").map(Number);
    if (hh! < 0 || hh! > 23 || mm! < 0 || mm! > 59) {
      throw new BadRequestException(`Invalid time values '${timeStr}'`);
    }
  }

  async createShift(gymId: string, dto: CreateCoachShiftDto) {
    this.validateTime(dto.startTime);
    this.validateTime(dto.endTime);

    // Verify staff belongs to gym
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.coachId, gymId, isActive: true },
    });
    if (!staff) {
      throw new NotFoundException("Staff member not found in gym or is not active");
    }

    // Check overlap for the same coach on dayOfWeek
    const existingShifts = await this.prisma.coachShift.findMany({
      where: { gymId, coachId: dto.coachId, dayOfWeek: dto.dayOfWeek, isActive: true },
    });

    const newStart = parseHHMM(dto.startTime);
    const newEnd = parseHHMM(dto.endTime);

    // Break shift down to daily minute intervals (handling overnight)
    const getIntervals = (start: number, end: number): [number, number][] => {
      if (start <= end) return [[start, end]];
      return [
        [start, 1440],
        [0, end],
      ];
    };

    const newIntervals = getIntervals(newStart, newEnd);

    for (const s of existingShifts) {
      const curIntervals = getIntervals(parseHHMM(s.startTime), parseHHMM(s.endTime));
      const overlaps = newIntervals.some(([ns, ne]) =>
        curIntervals.some(([cs, ce]) => ns < ce && cs < ne)
      );
      if (overlaps) {
        throw new BadRequestException("OVERLAPPING_SHIFT");
      }
    }

    return this.prisma.coachShift.create({
      data: {
        gymId,
        coachId: dto.coachId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: true,
      },
      include: {
        coach: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async createWeeklySchedule(gymId: string, dto: CreateCoachWeeklyScheduleDto) {
    this.validateTime(dto.startTime);
    this.validateTime(dto.endTime);

    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.coachId, gymId, isActive: true },
    });
    if (!staff) {
      throw new NotFoundException("Staff member not found in gym or is not active");
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.replaceExisting) {
        await tx.coachShift.updateMany({
          where: {
            gymId,
            coachId: dto.coachId,
            dayOfWeek: { in: dto.daysOfWeek },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      const created = [];
      for (const day of dto.daysOfWeek) {
        const shift = await tx.coachShift.create({
          data: {
            gymId,
            coachId: dto.coachId,
            dayOfWeek: day,
            startTime: dto.startTime,
            endTime: dto.endTime,
            isActive: true,
          },
          include: {
            coach: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        });
        created.push(shift);
      }
      return created;
    });
  }

  async getShifts(gymId: string, coachId?: string, dayOfWeek?: number) {
    const where: any = { gymId, isActive: true };
    if (coachId) where.coachId = coachId;
    if (dayOfWeek !== undefined) where.dayOfWeek = dayOfWeek;

    return this.prisma.coachShift.findMany({
      where,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: {
        coach: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async updateShift(gymId: string, shiftId: string, dto: UpdateCoachShiftDto) {
    const shift = await this.prisma.coachShift.findFirst({
      where: { id: shiftId, gymId },
    });
    if (!shift) {
      throw new NotFoundException("Coach shift not found");
    }

    if (dto.startTime) this.validateTime(dto.startTime);
    if (dto.endTime) this.validateTime(dto.endTime);

    return this.prisma.coachShift.update({
      where: { id: shiftId },
      data: {
        ...dto,
      },
      include: {
        coach: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async deactivateShift(gymId: string, shiftId: string) {
    const shift = await this.prisma.coachShift.findFirst({
      where: { id: shiftId, gymId },
    });
    if (!shift) {
      throw new NotFoundException("Coach shift not found");
    }

    return this.prisma.coachShift.update({
      where: { id: shiftId },
      data: { isActive: false },
    });
  }

  async getCoachesOnShift(gymId: string, at?: Date) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { timezone: true },
    });
    const timeZone = gym?.timezone || "Africa/Cairo";

    const allShifts = await this.prisma.coachShift.findMany({
      where: { gymId, isActive: true },
    });

    const shiftRows: CoachShiftRow[] = allShifts.map((s) => ({
      coachId: s.coachId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    }));

    const onShiftIds = coachIdsOnShift(shiftRows, at || new Date(), timeZone);

    const onShiftCoaches = await this.prisma.staff.findMany({
      where: { id: { in: onShiftIds }, gymId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });

    return {
      onShiftCoachIds: onShiftIds,
      coaches: onShiftCoaches,
    };
  }
}
