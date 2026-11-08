import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { CoachSessionsService } from "./coach-sessions.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateCoachSessionSchema,
  type CreateCoachSessionDto,
  AddSessionParticipantSchema,
  type AddSessionParticipantDto,
  RecordSessionAttendanceSchema,
  type RecordSessionAttendanceDto,
} from "@gym/contracts";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class CoachSessionsController {
  constructor(private readonly sessionsService: CoachSessionsService) {}

  @Get("me/trainees")
  @Roles("COACH")
  async getMyTrainees(@CurrentUser() user: any) {
    return this.sessionsService.getTrainees(user.gymId, user.sub);
  }

  @Get("coaches/:id/trainees")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "COACH")
  async getTrainees(@CurrentUser() user: any, @Param("id") coachId: string) {
    if (user.role === "COACH" && coachId !== user.sub) {
      throw new ForbiddenException("Coaches can only view their own trainees");
    }
    return this.sessionsService.getTrainees(user.gymId, coachId);
  }

  @Patch("coach-trainees/:id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async updateTrainee(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body("isActive") isActive: boolean
  ) {
    return this.sessionsService.updateTrainee(user.gymId, id, isActive);
  }

  @Post("coach-sessions")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async createSession(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateCoachSessionSchema)) dto: CreateCoachSessionDto
  ) {
    if (user.role === "COACH" && dto.coachId !== user.sub) {
      throw new ForbiddenException("Coaches can only create sessions for themselves");
    }
    return this.sessionsService.createSession(user.gymId, dto);
  }

  @Post("coach-sessions/:id/participants")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async addParticipant(
    @CurrentUser() user: any,
    @Param("id") sessionId: string,
    @Body(new ZodValidationPipe(AddSessionParticipantSchema)) dto: AddSessionParticipantDto
  ) {
    return this.sessionsService.addParticipant(user.gymId, sessionId, dto);
  }

  @Post("coach-sessions/:id/attendance")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async recordAttendance(
    @CurrentUser() user: any,
    @Param("id") sessionId: string,
    @Body(new ZodValidationPipe(RecordSessionAttendanceSchema)) dto: RecordSessionAttendanceDto
  ) {
    return this.sessionsService.recordAttendance(user.gymId, sessionId, dto);
  }

  @Post("coach-sessions/:id/no-show")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async recordNoShow(@CurrentUser() user: any, @Param("id") sessionId: string) {
    return this.sessionsService.recordNoShow(user.gymId, sessionId);
  }

  @Post("coach-sessions/:id/cancel")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async cancelSession(@CurrentUser() user: any, @Param("id") sessionId: string) {
    return this.sessionsService.cancelSession(user.gymId, sessionId);
  }

  @Get("coach-sessions")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getSessions(
    @CurrentUser() user: any,
    @Query("coachId") coachId?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    const targetCoachId = user.role === "COACH" ? user.sub : coachId;
    return this.sessionsService.getSessions(user.gymId, {
      coachId: targetCoachId,
      fromDate,
      toDate,
    });
  }
}

