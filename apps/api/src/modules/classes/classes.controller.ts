import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ClassesService } from "./classes.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { GymContextGuard } from "../../common/guards/gym-context.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  CreateClassScheduleSchema,
  type CreateClassScheduleDto,
  UpdateClassScheduleSchema,
  type UpdateClassScheduleDto,
  CreateClassExceptionSchema,
  type CreateClassExceptionDto,
  StartClassSchema,
  type StartClassDto,
} from "@gym/contracts";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, GymContextGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get("class-schedules")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH", "MEMBER")
  async listSchedules(@CurrentUser() user: any) {
    return this.classesService.listSchedules(user.gymId);
  }

  @Get("class-schedules/:id/members")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async getScheduleMembers(@CurrentUser() user: any, @Param("id") id: string) {
    return this.classesService.getScheduleMembers(user.gymId, id);
  }

  @Post("class-schedules")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async createSchedule(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateClassScheduleSchema)) body: CreateClassScheduleDto
  ) {
    return this.classesService.createSchedule(user.gymId, user.sub, body);
  }

  @Patch("class-schedules/:id")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async updateSchedule(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateClassScheduleSchema)) body: UpdateClassScheduleDto
  ) {
    return this.classesService.updateSchedule(user.gymId, user.sub, id, body);
  }

  @Post("class-schedules/:id/exceptions")
  @Roles("SUPER_ADMIN", "GYM_ADMIN")
  async addException(
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateClassExceptionSchema)) body: CreateClassExceptionDto
  ) {
    return this.classesService.addException(user.gymId, user.sub, id, body);
  }

  @Get("classes/today")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION", "COACH", "MEMBER")
  async getTodayClasses(@CurrentUser() user: any) {
    return this.classesService.getTodayClasses(user.gymId);
  }

  @Post("classes/:scheduleId/start")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async startClass(
    @CurrentUser() user: any,
    @Param("scheduleId") scheduleId: string,
    @Body() body?: StartClassDto
  ) {
    return this.classesService.startClass(user.gymId, user.sub, scheduleId, body);
  }

  @Post("classes/:scheduleId/end")
  @Roles("SUPER_ADMIN", "GYM_ADMIN", "RECEPTION")
  async endClass(
    @CurrentUser() user: any,
    @Param("scheduleId") scheduleId: string
  ) {
    return this.classesService.endClass(user.gymId, user.sub, scheduleId);
  }
}
