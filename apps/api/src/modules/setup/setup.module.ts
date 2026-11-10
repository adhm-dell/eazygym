import { Module } from "@nestjs/common";
import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";
import { PrismaService } from "../../prisma/prisma.service";

@Module({
  controllers: [SetupController],
  providers: [SetupService, PrismaService],
  exports: [SetupService],
})
export class SetupModule {}

