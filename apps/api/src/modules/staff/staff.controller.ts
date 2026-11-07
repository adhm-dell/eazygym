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
import { StaffService } from "./staff.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  type CreateStaffDto,
  type UpdateStaffDto,
} from "@gym/contracts";

@ApiTags("Staff")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("staff")
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles("GYM_ADMIN", "SUPER_ADMIN", "RECEPTION")
  @ApiOperation({ summary: "List all staff in current gym" })
  async listStaff(@Req() req: any) {
    return this.staffService.list(req.gymId);
  }

  @Get(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get staff member by id" })
  async getStaffById(@Req() req: any, @Param("id") id: string) {
    return this.staffService.getById(req.gymId, id);
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new staff member" })
  async createStaff(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateStaffSchema)) dto: CreateStaffDto
  ) {
    return this.staffService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update staff member or deactivate" })
  async updateStaff(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateStaffSchema)) dto: UpdateStaffDto
  ) {
    return this.staffService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }
}
