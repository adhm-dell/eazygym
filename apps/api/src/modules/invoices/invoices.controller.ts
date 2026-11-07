import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { InvoicesService } from "./invoices.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateInvoiceSchema,
  CollectPaymentSchema,
  type CreateInvoiceDto,
  type CollectPaymentDto,
} from "@gym/contracts";

@ApiTags("Invoices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "MEMBER")
  @ApiOperation({ summary: "List invoices with filters" })
  async listInvoices(
    @Req() req: any,
    @Query("memberId") memberId?: string,
    @Query("status") status?: string
  ) {
    const finalMemberId = req.user?.role === "MEMBER" ? req.user?.sub : memberId;
    return this.invoicesService.list(req.gymId, {
      memberId: finalMemberId,
      status,
    });
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "MEMBER")
  @ApiOperation({ summary: "Get detailed invoice by id" })
  async getInvoiceById(@Req() req: any, @Param("id") id: string) {
    return this.invoicesService.getById(req.gymId, id);
  }

  @Post()
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create invoice with multi-tender payment and auto subscriptions" })
  async createInvoice(
    @Req() req: any,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDto
  ) {
    return this.invoicesService.create(
      req.gymId,
      req.user?.id || req.user?.sub,
      req.user?.role,
      dto,
      idempotencyKey
    );
  }

  @Post(":id/payments")
  @Roles("GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "SUPER_ADMIN")
  @ApiOperation({ summary: "Collect outstanding balance payment on invoice" })
  async collectPayment(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CollectPaymentSchema)) dto: CollectPaymentDto
  ) {
    return this.invoicesService.collectPayment(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      dto
    );
  }

  @Post(":id/approve-discount")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Approve pending manual discount" })
  async approveDiscount(@Req() req: any, @Param("id") id: string) {
    return this.invoicesService.approveDiscount(
      req.gymId,
      req.user?.id || req.user?.sub,
      id
    );
  }

  @Post(":id/void")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Void invoice and reverse all financial effects" })
  async voidInvoice(
    @Req() req: any,
    @Param("id") id: string,
    @Body("reason") reason: string
  ) {
    return this.invoicesService.void(
      req.gymId,
      req.user?.id || req.user?.sub,
      id,
      reason
    );
  }
}
