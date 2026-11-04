import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

import { AuthModule } from "./modules/auth/auth.module";
import { GymsModule } from "./modules/gyms/gyms.module";
import { StaffModule } from "./modules/staff/staff.module";
import { MembersModule } from "./modules/members/members.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { PlansModule } from "./modules/plans/plans.module";
import { ServicesModule } from "./modules/services/services.module";
import { ProductsModule } from "./modules/products/products.module";
import { PromotionsModule } from "./modules/promotions/promotions.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { AccessModule } from "./modules/access/access.module";
import { ClassesModule } from "./modules/classes/classes.module";
import { ShiftsModule } from "./modules/shifts/shifts.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { VouchersModule } from "./modules/vouchers/vouchers.module";
import { CommissionsModule } from "./modules/commissions/commissions.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditModule } from "./modules/audit/audit.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    AuthModule,
    GymsModule,
    StaffModule,
    MembersModule,
    WalletModule,
    PlansModule,
    ServicesModule,
    ProductsModule,
    PromotionsModule,
    InvoicesModule,
    SubscriptionsModule,
    AccessModule,
    ClassesModule,
    ShiftsModule,
    ExpensesModule,
    VouchersModule,
    CommissionsModule,
    PayrollModule,
    NotificationsModule,
    ReportsModule,
    AuditModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}

