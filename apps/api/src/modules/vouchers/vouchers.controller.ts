import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { VouchersService } from "./vouchers.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";

@ApiTags("Vouchers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("vouchers")
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "List cash vouchers" })
  async listVouchers(@Req() req: any) {
    return this.vouchersService.list(req.gymId);
  }

  @Post("receipt")
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create standalone receipt voucher (سند قبض)" })
  async createReceipt(
    @Req() req: any,
    @Body("amount") amount: number,
    @Body("method") method: "CASH" | "INSTAPAY" | "CARD",
    @Body("note") note: string,
    @Body("reason") reason: string,
    @Body("memberId") memberId?: string
  ) {
    return this.vouchersService.createVoucher(
      req.gymId,
      req.user?.id || req.user?.sub,
      "RECEIPT",
      amount,
      method || "CASH",
      note || reason,
      memberId
    );
  }

  @Post("disbursement")
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create standalone disbursement voucher (سند صرف)" })
  async createDisbursement(
    @Req() req: any,
    @Body("amount") amount: number,
    @Body("method") method: "CASH" | "INSTAPAY" | "CARD",
    @Body("note") note: string,
    @Body("reason") reason: string,
    @Body("memberId") memberId?: string
  ) {
    return this.vouchersService.createVoucher(
      req.gymId,
      req.user?.id || req.user?.sub,
      "DISBURSEMENT",
      amount,
      method || "CASH",
      note || reason,
      memberId
    );
  }
}
