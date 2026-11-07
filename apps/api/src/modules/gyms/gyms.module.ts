import { Module } from "@nestjs/common";
import { GymsService } from "./gyms.service";
import { GymsController } from "./gyms.controller";
import { PrismaService } from "../../prisma/prisma.service";

@Module({
  controllers: [GymsController],
  providers: [GymsService, PrismaService],
  exports: [GymsService],
})
export class GymsModule {}
