import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CellarsModule } from './cellars/cellars.module';
import { BottlesModule } from './bottles/bottles.module';
import { WinesModule } from './wines/wines.module';
import { AiModule } from './ai/ai.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    WinesModule,
    CellarsModule,
    BottlesModule,
    StatsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
