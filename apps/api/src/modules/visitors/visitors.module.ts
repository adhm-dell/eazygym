import { Module } from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import { VisitorsController } from "./visitors.controller";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [VisitorsController],
  providers: [VisitorsService, PrismaService],
  exports: [VisitorsService],
})
export class VisitorsModule {}

