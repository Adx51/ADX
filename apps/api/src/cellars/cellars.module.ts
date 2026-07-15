import { Module } from '@nestjs/common';
import { CellarsService } from './cellars.service';
import { CellarsController } from './cellars.controller';

@Module({
  controllers: [CellarsController],
  providers: [CellarsService],
})
export class CellarsModule {}
