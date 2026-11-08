import { Module } from "@nestjs/common";
import { GymsService } from "./gyms.service";
import { GymsController, SuperAdminGymsController } from "./gyms.controller";
import { PrismaService } from "../../prisma/prisma.service";

@Module({
  controllers: [GymsController, SuperAdminGymsController],
  providers: [GymsService, PrismaService],
  exports: [GymsService],
})
export class GymsModule {}
