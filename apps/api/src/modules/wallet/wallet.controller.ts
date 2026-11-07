import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";

@ApiTags("Wallet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("members/:id/wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post("topup")
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "Top up member wallet using receipt voucher" })
  async topupWallet(
    @Req() req: any,
    @Param("id") memberId: string,
    @Body("amount") amount: number,
    @Body("method") method: "CASH" | "INSTAPAY" | "CARD",
    @Body("note") note?: string
  ) {
    return this.walletService.topup(
      req.gymId,
      req.user?.id || req.user?.sub,
      memberId,
      amount,
      method || "CASH",
      note
    );
  }

  @Post("payout")
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "Payout cash from member wallet using disbursement voucher" })
  async payoutWallet(
    @Req() req: any,
    @Param("id") memberId: string,
    @Body("amount") amount: number,
    @Body("note") note?: string
  ) {
    return this.walletService.payout(
      req.gymId,
      req.user?.id || req.user?.sub,
      memberId,
      amount,
      note
    );
  }

  @Post("adjust")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Admin manual wallet adjustment" })
  async adjustWallet(
    @Req() req: any,
    @Param("id") memberId: string,
    @Body("signedAmount") signedAmount: number,
    @Body("note") note: string
  ) {
    return this.walletService.adjust(
      req.gymId,
      req.user?.id || req.user?.sub,
      memberId,
      signedAmount,
      note
    );
  }
}
