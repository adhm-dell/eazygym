import { Module, Global, forwardRef } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { PrismaService } from "../../prisma/prisma.service";
import { InvoicesModule } from "../invoices/invoices.module";

@Global()
@Module({
  imports: [forwardRef(() => InvoicesModule)],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PrismaService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
