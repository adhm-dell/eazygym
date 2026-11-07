import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PromotionsService } from "./promotions.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreatePromotionSchema,
  UpdatePromotionSchema,
  PromotionPreviewSchema,
  type CreatePromotionDto,
  type UpdatePromotionDto,
  type PromotionPreviewDto,
} from "@gym/contracts";

@ApiTags("Promotions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("promotions")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "List promotional campaigns and discount codes" })
  async listPromotions(@Req() req: any) {
    return this.promotionsService.list(req.gymId);
  }

  @Get(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get promotion details by id" })
  async getPromotionById(@Req() req: any, @Param("id") id: string) {
    return this.promotionsService.getById(req.gymId, id);
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new promotion rule" })
  async createPromotion(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreatePromotionSchema)) dto: CreatePromotionDto
  ) {
    return this.promotionsService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update promotion parameters" })
  async updatePromotion(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdatePromotionSchema)) dto: UpdatePromotionDto
  ) {
    return this.promotionsService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }

  @Post(":id/deactivate")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Deactivate promotion" })
  async deactivatePromotion(@Req() req: any, @Param("id") id: string) {
    return this.promotionsService.deactivate(req.gymId, req.user?.id || req.user?.sub, id);
  }

  @Post("preview")
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Preview promotion discount split on cart items" })
  async previewPromotion(
    @Req() req: any,
    @Body(new ZodValidationPipe(PromotionPreviewSchema)) dto: PromotionPreviewDto
  ) {
    return this.promotionsService.preview(req.gymId, dto);
  }

  @Get(":id/usage")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get promotion redemption stats and total discounts granted" })
  async getPromotionUsage(@Req() req: any, @Param("id") id: string) {
    return this.promotionsService.getUsage(req.gymId, id);
  }
}
