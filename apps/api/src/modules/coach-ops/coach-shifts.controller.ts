import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { CoachShiftsService } from "./coach-shifts.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateCoachShiftSchema,
  type CreateCoachShiftDto,
  UpdateCoachShiftSchema,
  type UpdateCoachShiftDto,
} from "@gym/contracts";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class CoachShiftsController {
  constructor(private readonly shiftsService: CoachShiftsService) {}

  @Post("coach-shifts")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async createShift(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateCoachShiftSchema)) dto: CreateCoachShiftDto
  ) {
    return this.shiftsService.createShift(user.gymId, dto);
  }

  @Get("coach-shifts")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getShifts(
    @CurrentUser() user: any,
    @Query("coachId") coachId?: string,
    @Query("dayOfWeek") dayOfWeek?: string
  ) {
    // If user is COACH, they can only view their own shifts unless admin/reception
    if (user.role === "COACH" && coachId && coachId !== user.sub) {
      throw new ForbiddenException("Coaches can only view their own shifts");
    }
    const targetCoachId = user.role === "COACH" ? user.sub : coachId;
    const parsedDay = dayOfWeek !== undefined ? parseInt(dayOfWeek, 10) : undefined;
    return this.shiftsService.getShifts(user.gymId, targetCoachId, parsedDay);
  }

  @Patch("coach-shifts/:id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async updateShift(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCoachShiftSchema)) dto: UpdateCoachShiftDto
  ) {
    return this.shiftsService.updateShift(user.gymId, id, dto);
  }

  @Delete("coach-shifts/:id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async deactivateShift(@CurrentUser() user: any, @Param("id") id: string) {
    return this.shiftsService.deactivateShift(user.gymId, id);
  }

  @Get("coaches/on-shift")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getCoachesOnShift(
    @CurrentUser() user: any,
    @Query("at") at?: string
  ) {
    const atDate = at ? new Date(at) : undefined;
    return this.shiftsService.getCoachesOnShift(user.gymId, atDate);
  }
}

