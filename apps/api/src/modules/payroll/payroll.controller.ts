import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PayrollService } from "./payroll.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreatePayrollRunSchema,
  AddPayrollLineSchema,
  ClosePayrollRunSchema,
  type CreatePayrollRunDto,
  type AddPayrollLineDto,
  type ClosePayrollRunDto,
} from "@gym/contracts";

@ApiTags("Payroll")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("payroll/runs")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "List all monthly payroll runs" })
  async listRuns(@CurrentUser() user: any) {
    return this.payrollService.listRuns(user.gymId);
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new draft payroll run for a month" })
  async createRun(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreatePayrollRunSchema)) body: CreatePayrollRunDto
  ) {
    return this.payrollService.createRun(user.gymId, user.sub, body.year, body.month);
  }

  @Get(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get detailed payroll run with breakdown by staff" })
  async getRun(@CurrentUser() user: any, @Param("id") id: string) {
    return this.payrollService.getRun(user.gymId, id);
  }

  @Post(":id/recalculate")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Recalculate draft payroll run" })
  async recalculateRun(@CurrentUser() user: any, @Param("id") id: string) {
    return this.payrollService.recalculateRun(user.gymId, id);
  }

  @Post(":id/lines")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Add manual BONUS or DEDUCTION line to draft run" })
  async addLine(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AddPayrollLineSchema)) body: AddPayrollLineDto
  ) {
    return this.payrollService.addLine(user.gymId, id, body);
  }

  @Delete(":id/lines/:lineId")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Delete manual line from draft run" })
  async deleteLine(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Param("lineId") lineId: string
  ) {
    return this.payrollService.deleteLine(user.gymId, id, lineId);
  }

  @Post(":id/close")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Close and lock payroll run, freezing entries" })
  async closeRun(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ClosePayrollRunSchema)) _body: ClosePayrollRunDto
  ) {
    return this.payrollService.closeRun(user.gymId, user.sub, id);
  }
}
