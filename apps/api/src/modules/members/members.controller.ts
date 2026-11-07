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
import { MembersService } from "./members.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateMemberSchema,
  UpdateMemberSchema,
  BlockMemberSchema,
  SetMemberPasswordSchema,
  type CreateMemberDto,
  type UpdateMemberDto,
  type BlockMemberDto,
  type SetMemberPasswordDto,
} from "@gym/contracts";

@ApiTags("Members")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles("GYM_ADMIN", "RECEPTION", "COACH", "SUPER_ADMIN")
  @ApiOperation({ summary: "List members with search and multi-criteria filters" })
  async listMembers(
    @Req() req: any,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("planKind") planKind?: string,
    @Query("coachId") coachId?: string,
    @Query("expiringInDays") expiringInDays?: string,
    @Query("overdue") overdue?: string,
    @Query("blocked") blocked?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.membersService.list({
      gymId: req.gymId,
      userRole: req.user?.role,
      userId: req.user?.sub || req.user?.id,
      search,
      status,
      planKind,
      coachId,
      expiringInDays: expiringInDays ? parseInt(expiringInDays, 10) : undefined,
      overdue: overdue === "true",
      blocked: blocked !== undefined ? blocked === "true" : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post()
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create new member with auto-generated code and empty wallet" })
  async createMember(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateMemberSchema)) dto: CreateMemberDto
  ) {
    return this.membersService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Get(":id")
  @Roles("GYM_ADMIN", "RECEPTION", "COACH", "MEMBER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get member overview including wallet balance and subscriptions" })
  async getMemberById(@Req() req: any, @Param("id") id: string) {
    return this.membersService.getById(req.gymId, id, {
      id: req.user?.sub || req.user?.id,
      role: req.user?.role,
    });
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update member profile" })
  async updateMember(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateMemberSchema)) dto: UpdateMemberDto
  ) {
    return this.membersService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }

  @Post(":id/block")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Block member with reason" })
  async blockMember(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(BlockMemberSchema)) dto: BlockMemberDto
  ) {
    return this.membersService.block(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }

  @Post(":id/unblock")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Unblock member" })
  async unblockMember(@Req() req: any, @Param("id") id: string) {
    return this.membersService.unblock(req.gymId, req.user?.id || req.user?.sub, id);
  }

  @Post(":id/set-password")
  @Roles("GYM_ADMIN", "RECEPTION", "SUPER_ADMIN")
  @ApiOperation({ summary: "Set member password for mobile/portal login" })
  async setMemberPassword(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SetMemberPasswordSchema)) dto: SetMemberPasswordDto
  ) {
    return this.membersService.setPassword(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Get(":id/wallet")
  @Roles("GYM_ADMIN", "RECEPTION", "MEMBER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Get member wallet balance and transaction ledger" })
  async getMemberWallet(@Req() req: any, @Param("id") id: string) {
    return this.membersService.getWallet(req.gymId, id, {
      id: req.user?.sub || req.user?.id,
      role: req.user?.role,
    });
  }
}
