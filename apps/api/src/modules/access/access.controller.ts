import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AccessService } from "./access.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ScanRequestSchema, type ScanRequest } from "@gym/contracts";

@Controller("access")
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post("scan")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async scan(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(ScanRequestSchema)) body: ScanRequest
  ) {
    const customNow = body.timestamp ? new Date(body.timestamp) : undefined;
    return this.accessService.scan(user.gymId, user.sub, body.code, customNow, body.subscriptionId);
  }

  @Get("logs")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async getLogs(
    @CurrentUser() user: any,
    @Query("limit") limit?: string
  ) {
    const lim = limit ? parseInt(limit, 10) : 20;
    return this.accessService.getRecentLogs(user.gymId, lim);
  }
}
