import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateExpenseSchema,
  type CreateExpenseDto,
} from "@gym/contracts";

@Controller("expenses")
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async createExpense(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateExpenseSchema)) body: CreateExpenseDto
  ) {
    return this.expensesService.createExpense(user.gymId, user.sub, body);
  }

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER")
  async listExpenses(
    @CurrentUser() user: any,
    @Query("shiftId") shiftId?: string,
    @Query("category") category?: string
  ) {
    return this.expensesService.listExpenses(user.gymId, user.sub, user.role, { shiftId, category });
  }

  @Post(":id/void")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async voidExpense(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body() body: { reason?: string; voidReason?: string }
  ) {
    return this.expensesService.voidExpense(user.gymId, user.sub, id, body);
  }
}
