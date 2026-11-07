import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { CoachBreaksService } from "./coach-breaks.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  RequestCoachBreakSchema,
  type RequestCoachBreakDto,
  RejectCoachBreakSchema,
  type RejectCoachBreakDto,
  NotifyBreakReturnSchema,
  type NotifyBreakReturnDto,
} from "@gym/contracts";

@Controller("coach-breaks")
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class CoachBreaksController {
  constructor(private readonly breaksService: CoachBreaksService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getBreaks(@CurrentUser() user: any, @Query("coachId") coachId?: string) {
    if (user.role === "COACH" && coachId && coachId !== user.sub) {
      throw new ForbiddenException("Coaches can only view their own breaks");
    }
    const targetCoachId = user.role === "COACH" ? user.sub : coachId;
    return this.breaksService.getBreaks(user.gymId, targetCoachId);
  }

  @Post()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async requestBreak(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(RequestCoachBreakSchema)) dto: RequestCoachBreakDto,
    @Query("now") overrideNow?: string
  ) {
    const now = overrideNow ? new Date(overrideNow) : undefined;
    return this.breaksService.requestBreak(
      user.gymId,
      { id: user.sub, role: user.role },
      dto,
      now
    );
  }

  @Post(":id/approve")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async approveBreak(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Query("now") overrideNow?: string
  ) {
    const now = overrideNow ? new Date(overrideNow) : undefined;
    return this.breaksService.approveBreak(user.gymId, id, user.sub, now);
  }

  @Post(":id/reject")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async rejectBreak(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectCoachBreakSchema)) dto: RejectCoachBreakDto
  ) {
    return this.breaksService.rejectBreak(user.gymId, id, user.sub, dto);
  }

  @Post(":id/end")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async endBreak(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Query("now") overrideNow?: string
  ) {
    const now = overrideNow ? new Date(overrideNow) : undefined;
    return this.breaksService.endBreak(
      user.gymId,
      id,
      { id: user.sub, role: user.role },
      now
    );
  }

  @Post("notify-return")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async notifyReturn(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(NotifyBreakReturnSchema)) dto: NotifyBreakReturnDto
  ) {
    return this.breaksService.notifyReturn(user.gymId, dto);
  }

  @Post("check-overdue")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async checkOverdue(
    @CurrentUser() user: any,
    @Query("now") overrideNow?: string
  ) {
    const now = overrideNow ? new Date(overrideNow) : undefined;
    return this.breaksService.checkOverdueBreaks(user.gymId, now);
  }
}

