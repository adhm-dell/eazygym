import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('health')
  health() {
    return { module: 'plans', status: 'ok' };
  }
}
