import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CommissionsService } from "./commissions.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  SetCommissionTiersSchema,
  type SetCommissionTiersDto,
} from "@gym/contracts";

@ApiTags("Commissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller()
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get("commission-tiers")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get commission tiers for coach or gym default" })
  async getTiers(
    @CurrentUser() user: any,
    @Query("coachId") coachId?: string
  ) {
    return this.commissionsService.getTiers(user.gymId, coachId);
  }

  @Put("commission-tiers")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Set commission tiers atomically" })
  async setTiers(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(SetCommissionTiersSchema)) body: SetCommissionTiersDto
  ) {
    return this.commissionsService.setTiers(user.gymId, body.coachId, body.tiers);
  }

  @Get("me/commission")
  @Roles("COACH")
  @ApiOperation({ summary: "Get logged-in coach's commission breakdown and tier progress" })
  async getMyCommission(
    @CurrentUser() user: any,
    @Query("year") yearStr?: string,
    @Query("month") monthStr?: string
  ) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthStr && monthStr.includes("-")) {
      const parts = monthStr.split("-").map((p) => parseInt(p, 10));
      year = parts[0] || year;
      month = parts[1] || month;
    } else {
      if (yearStr) year = parseInt(yearStr, 10);
      if (monthStr) month = parseInt(monthStr, 10);
    }

    return this.commissionsService.getCoachMonthlyCommission(
      user.gymId,
      user.sub,
      year,
      month
    );
  }

  @Get("coaches/:id/commission")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get coach commission breakdown by admin" })
  async getCoachCommission(
    @CurrentUser() user: any,
    @Param("id") coachId: string,
    @Query("year") yearStr?: string,
    @Query("month") monthStr?: string
  ) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthStr && monthStr.includes("-")) {
      const parts = monthStr.split("-").map((p) => parseInt(p, 10));
      year = parts[0] || year;
      month = parts[1] || month;
    } else {
      if (yearStr) year = parseInt(yearStr, 10);
      if (monthStr) month = parseInt(monthStr, 10);
    }

    return this.commissionsService.getCoachMonthlyCommission(
      user.gymId,
      coachId,
      year,
      month
    );
  }
}
