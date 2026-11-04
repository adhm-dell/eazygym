import { Controller, Get } from '@nestjs/common';
import { AccessService } from './access.service';

@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('health')
  health() {
    return { module: 'access', status: 'ok' };
  }
}
