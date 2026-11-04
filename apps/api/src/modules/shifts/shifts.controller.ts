import { Controller, Get } from '@nestjs/common';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('health')
  health() {
    return { module: 'shifts', status: 'ok' };
  }
}
