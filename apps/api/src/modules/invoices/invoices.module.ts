import { Module, forwardRef } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { PrismaService } from "../../prisma/prisma.service";
import { NumberingModule } from "../numbering/numbering.module";
import { PromotionsModule } from "../promotions/promotions.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [NumberingModule, PromotionsModule, forwardRef(() => SubscriptionsModule)],
  controllers: [InvoicesController],
  providers: [InvoicesService, PrismaService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
