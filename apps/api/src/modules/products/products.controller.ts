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
import { ProductsService } from "./products.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateProductSchema,
  UpdateProductSchema,
  type CreateProductDto,
  type UpdateProductDto,
} from "@gym/contracts";

@ApiTags("Products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "BAR_CASHIER", "COACH")
  @ApiOperation({ summary: "List retail/bar products with inventory stock" })
  async listProducts(@Req() req: any, @Query("active") active?: string) {
    return this.productsService.list(
      req.gymId,
      active !== undefined ? active === "true" : undefined
    );
  }

  @Post()
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Create retail product with initial stock" })
  async createProduct(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto
  ) {
    return this.productsService.create(req.gymId, req.user?.id || req.user?.sub, dto);
  }

  @Patch(":id")
  @Roles("GYM_ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Update product stock, price, or details" })
  async updateProduct(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto
  ) {
    return this.productsService.update(req.gymId, req.user?.id || req.user?.sub, id, dto);
  }
}
