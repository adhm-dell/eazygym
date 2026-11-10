import { Controller, Get, Post, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { GymsService } from "./gyms.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { NoGymContext } from "../../common/decorators/no-gym-context.decorator";
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

@ApiTags("SuperAdmin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@NoGymContext()
@Controller("admin/gyms")
export class SuperAdminGymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get()
  @Roles("SUPER_ADMIN")
  @ApiOperation({ summary: "List all gyms across platform with stats" })
  async listGyms() {
    return this.gymsService.listGyms();
  }

  @Post()
  @Roles("SUPER_ADMIN")
  @ApiOperation({ summary: "Create new gym and first GYM_ADMIN" })
  async createGym(@Body() body: any) {
    return this.gymsService.createGym(body);
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN")
  @ApiOperation({ summary: "Toggle gym active/deactivated status" })
  async toggleGymStatus(@Req() req: any, @Body("isActive") isActive: boolean) {
    const gymId = req.params.id;
    return this.gymsService.toggleGymActive(gymId, isActive);
  }
}
