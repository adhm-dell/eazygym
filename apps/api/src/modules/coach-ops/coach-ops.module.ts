import { Module } from "@nestjs/common";
import { CoachShiftsController } from "./coach-shifts.controller";
import { CoachShiftsService } from "./coach-shifts.service";
import { CoachBreaksController } from "./coach-breaks.controller";
import { CoachBreaksService } from "./coach-breaks.service";
import { FitnessProfilesController } from "./fitness-profiles.controller";
import { FitnessProfilesService } from "./fitness-profiles.service";
import { CoachSessionsController } from "./coach-sessions.controller";
import { CoachSessionsService } from "./coach-sessions.service";

import { PrismaService } from "../../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [
    CoachShiftsController,
    CoachBreaksController,
    FitnessProfilesController,
    CoachSessionsController,
  ],
  providers: [
    PrismaService,
    CoachShiftsService,
    CoachBreaksService,
    FitnessProfilesService,
    CoachSessionsService,
  ],
  exports: [
    CoachShiftsService,
    CoachBreaksService,
    FitnessProfilesService,
    CoachSessionsService,
  ],
})
export class CoachOpsModule {}
