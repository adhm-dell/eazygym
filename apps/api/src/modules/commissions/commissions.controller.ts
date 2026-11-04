import { Controller, Get } from '@nestjs/common';
import { CommissionsService } from './commissions.service';

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('health')
  health() {
    return { module: 'commissions', status: 'ok' };
  }
}
