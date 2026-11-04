import { Controller, Get } from '@nestjs/common';
import { VouchersService } from './vouchers.service';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get('health')
  health() {
    return { module: 'vouchers', status: 'ok' };
  }
}
