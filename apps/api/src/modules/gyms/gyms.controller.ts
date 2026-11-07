import { Controller, Get, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { GymsService } from "./gyms.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  UpdateGymSettingsSchema,
  type UpdateGymSettingsDto,
} from "@gym/contracts";

@ApiTags("Gym")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("gym")
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get("settings")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get current gym settings" })
  async getSettings(@Req() req: any) {
    return this.gymsService.getSettings(req.gymId);
  }

  @Patch("settings")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update gym configuration and business parameters" })
  async updateSettings(
    @Req() req: any,
    @Body(new ZodValidationPipe(UpdateGymSettingsSchema)) dto: UpdateGymSettingsDto
  ) {
    return this.gymsService.updateSettings(req.gymId, req.user?.id || req.user?.sub, dto);
  }
}
