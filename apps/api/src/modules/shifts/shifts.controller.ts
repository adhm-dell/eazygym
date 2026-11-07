import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ShiftsService } from "./shifts.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  OpenShiftSchema,
  type OpenShiftDto,
  CloseShiftSchema,
  type CloseShiftDto,
  CloseAllShiftsSchema,
  type CloseAllShiftsDto,
} from "@gym/contracts";

@Controller("shifts")
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post("open")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async openShift(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(OpenShiftSchema)) body: OpenShiftDto
  ) {
    return this.shiftsService.openShift(user.gymId, user.sub, body);
  }

  @Get("current")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async getCurrentShift(@CurrentUser() user: any) {
    return this.shiftsService.getCurrentShift(user.gymId, user.sub);
  }

  @Post(":id/close")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async closeShift(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CloseShiftSchema)) body: CloseShiftDto
  ) {
    return this.shiftsService.closeShift(user.gymId, user.sub, user.role, id, body);
  }

  @Post("close-all")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async closeAllShifts(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CloseAllShiftsSchema)) body: CloseAllShiftsDto
  ) {
    return this.shiftsService.closeAllShifts(user.gymId, user.sub, body);
  }

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async listShifts(
    @CurrentUser() user: any,
    @Query("staffId") staffId?: string,
    @Query("status") status?: string,
    @Query("hasVariance") hasVariance?: string
  ) {
    return this.shiftsService.listShifts(user.gymId, { staffId, status, hasVariance });
  }

  @Get(":id/report")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async getShiftReport(
    @CurrentUser() user: any,
    @Param("id") id: string
  ) {
    return this.shiftsService.getShiftReport(user.gymId, id);
  }
}
