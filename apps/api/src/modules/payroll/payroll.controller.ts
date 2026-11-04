import { Controller, Get } from '@nestjs/common';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('health')
  health() {
    return { module: 'payroll', status: 'ok' };
  }
}
