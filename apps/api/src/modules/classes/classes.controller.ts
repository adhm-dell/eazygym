import { Controller, Get } from '@nestjs/common';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('health')
  health() {
    return { module: 'classes', status: 'ok' };
  }
}
