import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("daily-revenue")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Daily revenue breakdown by payment method" })
  async getDailyRevenue(@CurrentUser() user: any, @Query("date") date?: string) {
    return this.reportsService.getDailyRevenue(user.gymId, date);
  }

  @Get("expiring-subscriptions")
  @Roles("GYM_ADMIN", "SUPER_ADMIN", "RECEPTION")
  @ApiOperation({ summary: "Subscriptions expiring within N days" })
  async getExpiringSubscriptions(
    @CurrentUser() user: any,
    @Query("days") daysStr?: string
  ) {
    const days = daysStr ? parseInt(daysStr, 10) : 7;
    return this.reportsService.getExpiringSubscriptions(user.gymId, days);
  }

  @Get("overdue-balances")
  @Roles("GYM_ADMIN", "SUPER_ADMIN", "RECEPTION")
  @ApiOperation({ summary: "Overdue subscription balances" })
  async getOverdueBalances(@CurrentUser() user: any) {
    return this.reportsService.getOverdueBalances(user.gymId);
  }

  @Get("promotion-usage")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Promotion redemption and discount report" })
  async getPromotionUsage(@CurrentUser() user: any) {
    return this.reportsService.getPromotionUsage(user.gymId);
  }

  @Get("coach-performance")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Coach monthly performance matrix" })
  async getCoachPerformance(
    @CurrentUser() user: any,
    @Query("month") month?: string
  ) {
    return this.reportsService.getCoachPerformance(user.gymId, month);
  }
}
