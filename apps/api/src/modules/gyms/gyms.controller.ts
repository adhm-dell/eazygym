import { Controller, Get } from '@nestjs/common';
import { GymsService } from './gyms.service';

@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get('health')
  health() {
    return { module: 'gyms', status: 'ok' };
  }
}
