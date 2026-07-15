import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(@CurrentUserId() userId: string) {
    return this.stats.overview(userId);
  }

  @Get('distribution')
  distribution(@CurrentUserId() userId: string) {
    return this.stats.distribution(userId);
  }

  @Get('alerts')
  alerts(@CurrentUserId() userId: string) {
    return this.stats.alerts(userId);
  }
}
