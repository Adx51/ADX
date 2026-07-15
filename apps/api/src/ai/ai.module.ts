import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { EnrichmentService } from './enrichment.service';
import { SommelierService } from './sommelier.service';
import { ScannerService } from './scanner.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [OpenAiService, EnrichmentService, SommelierService, ScannerService],
  exports: [OpenAiService, EnrichmentService, ScannerService],
})
export class AiModule {}
