import { Controller, Get } from '@nestjs/common';

const API_BUILD_MARKER = 'sector-debug-v1';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      build: API_BUILD_MARKER,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
