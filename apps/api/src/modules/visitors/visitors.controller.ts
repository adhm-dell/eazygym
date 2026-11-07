import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateVisitorSchema,
  type CreateVisitorDto,
  CheckInVisitorSchema,
  type CheckInVisitorDto,
} from "@gym/contracts";

@Controller("visitors")
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async searchVisitors(
    @CurrentUser() user: any,
    @Query("q") q?: string
  ) {
    return this.visitorsService.searchVisitors(user.gymId, q);
  }

  @Post()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async createVisitor(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateVisitorSchema)) body: CreateVisitorDto
  ) {
    return this.visitorsService.createVisitor(user.gymId, user.sub, body);
  }

  @Post("check-in")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async checkInVisitor(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CheckInVisitorSchema)) body: CheckInVisitorDto
  ) {
    return this.visitorsService.checkInVisitor(user.gymId, user.sub, body);
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH")
  async getVisitorById(
    @CurrentUser() user: any,
    @Param("id") id: string
  ) {
    return this.visitorsService.getVisitorById(user.gymId, id);
  }
}

