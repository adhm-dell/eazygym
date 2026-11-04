import { Controller, Get } from '@nestjs/common';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('health')
  health() {
    return { module: 'staff', status: 'ok' };
  }
}
