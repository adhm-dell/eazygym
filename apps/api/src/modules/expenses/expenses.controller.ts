import { Controller, Get } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('health')
  health() {
    return { module: 'expenses', status: 'ok' };
  }
}
