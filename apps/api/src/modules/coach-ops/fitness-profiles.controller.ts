import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FitnessProfilesService } from "./fitness-profiles.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  UpdateFitnessProfileSchema,
  type UpdateFitnessProfileDto,
  CreateFitnessAssessmentSchema,
  type CreateFitnessAssessmentDto,
  AssignFitnessProfileSchema,
  type AssignFitnessProfileDto,
  RejectFitnessAssignmentSchema,
  type RejectFitnessAssignmentDto,
  UpdateRotationQueueSchema,
  type UpdateRotationQueueDto,
} from "@gym/contracts";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class FitnessProfilesController {
  constructor(private readonly fitnessService: FitnessProfilesService) {}

  @Get("fitness-assignments")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getAssignments(
    @CurrentUser() user: any,
    @Query("status") status?: string
  ) {
    const coachId = user.role === "COACH" ? user.sub : undefined;
    return this.fitnessService.getAssignments(user.gymId, status, coachId);
  }

  @Post("fitness-assignments/:id/accept")
  @Roles("COACH")
  async acceptAssignment(@CurrentUser() user: any, @Param("id") id: string) {
    return this.fitnessService.acceptAssignment(user.gymId, id, user.sub);
  }

  @Post("fitness-assignments/:id/reject")
  @Roles("COACH")
  async rejectAssignment(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectFitnessAssignmentSchema)) dto: RejectFitnessAssignmentDto
  ) {
    return this.fitnessService.rejectAssignment(user.gymId, id, user.sub, dto);
  }

  @Post("fitness-profiles/:id/assign")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async assignManually(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AssignFitnessProfileSchema)) dto: AssignFitnessProfileDto
  ) {
    return this.fitnessService.assignManually(user.gymId, id, dto, user.sub);
  }

  @Get("members/:id/fitness-profile")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getFitnessProfile(@CurrentUser() user: any, @Param("id") memberId: string) {
    return this.fitnessService.getFitnessProfile(user.gymId, memberId);
  }

  @Patch("members/:id/fitness-profile")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async updateFitnessProfile(
    @CurrentUser() user: any,
    @Param("id") memberId: string,
    @Body(new ZodValidationPipe(UpdateFitnessProfileSchema)) dto: UpdateFitnessProfileDto
  ) {
    return this.fitnessService.updateFitnessProfile(user.gymId, memberId, dto);
  }

  @Get("members/:id/assessments")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getAssessments(@CurrentUser() user: any, @Param("id") memberId: string) {
    return this.fitnessService.getAssessments(user.gymId, memberId);
  }

  @Post("members/:id/assessments")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async createAssessment(
    @CurrentUser() user: any,
    @Param("id") memberId: string,
    @Body(new ZodValidationPipe(CreateFitnessAssessmentSchema)) dto: CreateFitnessAssessmentDto
  ) {
    return this.fitnessService.createAssessment(user.gymId, memberId, dto, user.sub);
  }

  @Get("coach-rotation-queue")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async getRotationQueue(@CurrentUser() user: any) {
    return this.fitnessService.getRotationQueue(user.gymId);
  }

  @Put("coach-rotation-queue")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async updateRotationQueue(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(UpdateRotationQueueSchema)) dto: UpdateRotationQueueDto
  ) {
    return this.fitnessService.updateRotationQueue(user.gymId, dto);
  }
}

