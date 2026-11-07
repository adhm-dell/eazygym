import { Module, Global } from "@nestjs/common";
import { NumberingService } from "./numbering.service";
import { PrismaService } from "../../prisma/prisma.service";

@Global()
@Module({
  providers: [NumberingService, PrismaService],
  exports: [NumberingService],
})
export class NumberingModule {}

