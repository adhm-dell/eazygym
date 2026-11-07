import { Module } from "@nestjs/common";
import { PayrollService } from "./payroll.service";
import { PayrollController } from "./payroll.controller";
import { PrismaService } from "../../prisma/prisma.service";
import { CommissionsModule } from "../commissions/commissions.module";

@Module({
  imports: [CommissionsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService],
  exports: [PayrollService],
})
export class PayrollModule {}
