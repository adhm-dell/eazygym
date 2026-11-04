import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService, PrismaService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
