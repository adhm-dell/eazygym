import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  FreezeSubscriptionSchema,
  UnfreezeSubscriptionSchema,
  CancelSubscriptionSchema,
  ChangeCoachSchema,
  LogPtSessionSchema,
  type FreezeSubscriptionDto,
  type UnfreezeSubscriptionDto,
  type CancelSubscriptionDto,
  type ChangeCoachDto,
  type LogPtSessionDto,
} from "@gym/contracts";

@ApiTags("Subscriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "List subscriptions with filtering" })
  async listSubscriptions(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("kind") kind?: string,
    @Query("memberId") memberId?: string,
    @Query("coachId") coachId?: string
  ) {
    return this.subscriptionsService.list(req.gymId, {
      status,
      kind,
      memberId,
      coachId,
    });
  }

  @Post(":id/freeze")
  @Roles("GYM_ADMIN", "RECEPTION", "MEMBER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Freeze subscription within plan allowance" })
  async freezeSubscription(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(FreezeSubscriptionSchema)) dto: FreezeSubscriptionDto
  ) {
    return this.subscriptionsService.freeze(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Post(":id/unfreeze")
  @Roles("GYM_ADMIN", "RECEPTION", "MEMBER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Unfreeze subscription and push end date forward" })
  async unfreezeSubscription(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UnfreezeSubscriptionSchema)) dto: UnfreezeSubscriptionDto
  ) {
    return this.subscriptionsService.unfreeze(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Post(":id/cancel")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Cancel subscription" })
  async cancelSubscription(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CancelSubscriptionSchema)) dto: CancelSubscriptionDto
  ) {
    return this.subscriptionsService.cancel(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Post(":id/change-coach")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Change PT coach assignment with commission split" })
  async changeCoach(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ChangeCoachSchema)) dto: ChangeCoachDto
  ) {
    return this.subscriptionsService.changeCoach(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Post(":id/log-session")
  @Roles("COACH", "GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Log completed PT session" })
  async logSession(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(LogPtSessionSchema)) dto: LogPtSessionDto
  ) {
    return this.subscriptionsService.logSession(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }
}
