import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ServicesService } from "./services.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  type CreateServiceDto,
  type UpdateServiceDto,
} from "@gym/contracts";

@ApiTags("Services")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "COACH")
  @ApiOperation({ summary: "List services with active filter" })
  async listServices(@Req() req: any, @Query("active") active?: string) {
    return this.servicesService.list(
      req.gymId,
      active !== undefined ? active === "true" : undefined
    );
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new gym service (InBody, locker, etc.)" })
  async createService(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateServiceSchema)) dto: CreateServiceDto
  ) {
    return this.servicesService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update gym service" })
  async updateService(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) dto: UpdateServiceDto
  ) {
    return this.servicesService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }
}
