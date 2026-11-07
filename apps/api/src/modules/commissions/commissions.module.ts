import { Module, Global } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { CommissionsController } from "./commissions.controller";
import { PrismaService } from "../../prisma/prisma.service";

@Global()
@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService, PrismaService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
