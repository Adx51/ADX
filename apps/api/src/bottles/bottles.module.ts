import { Module } from '@nestjs/common';
import { BottlesService } from './bottles.service';
import { BottlesController } from './bottles.controller';
import { WinesModule } from '../wines/wines.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [WinesModule, AiModule],
  controllers: [BottlesController],
  providers: [BottlesService],
})
export class BottlesModule {}
