import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("Dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get live KPI dashboard stats for the current gym" })
  async getDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getDashboard(user.gymId);
  }
}

