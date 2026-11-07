import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreatePlanSchema,
  UpdatePlanSchema,
  type CreatePlanDto,
  type UpdatePlanDto,
} from "@gym/contracts";

@ApiTags("Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "COACH", "MEMBER")
  @ApiOperation({ summary: "List plans with kind and active filters" })
  async listPlans(
    @Req() req: any,
    @Query("kind") kind?: string,
    @Query("active") active?: string
  ) {
    return this.plansService.list(
      req.gymId,
      kind,
      active !== undefined ? active === "true" : undefined
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "COACH", "MEMBER")
  @ApiOperation({ summary: "Get plan details by id" })
  async getPlanById(@Req() req: any, @Param("id") id: string) {
    return this.plansService.getById(req.gymId, id);
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new subscription plan" })
  async createPlan(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreatePlanSchema)) dto: CreatePlanDto
  ) {
    return this.plansService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update plan policies and pricing" })
  async updatePlan(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdatePlanSchema)) dto: UpdatePlanDto
  ) {
    return this.plansService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }

  @Post(":id/archive")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Archive plan (soft delete)" })
  async archivePlan(@Req() req: any, @Param("id") id: string) {
    return this.plansService.archive(req.gymId, req.user?.id || req.user?.sub, id);
  }
}
