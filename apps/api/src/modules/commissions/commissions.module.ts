import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService, PrismaService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
