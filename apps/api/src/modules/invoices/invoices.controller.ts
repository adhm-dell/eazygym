import { Controller, Get } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('health')
  health() {
    return { module: 'invoices', status: 'ok' };
  }
}
