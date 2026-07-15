import { Body, Controller, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { SommelierService } from './sommelier.service';
import { ScannerService } from './scanner.service';
import { CurrentUserId } from '../common/current-user.decorator';

class AskDto {
  @IsString()
  question!: string;
}

class ScanDto {
  // Accepts an https URL or a base64 `data:` URL (photo taken on the device).
  @IsString()
  @MaxLength(16_000_000)
  image!: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly sommelier: SommelierService,
    private readonly scanner: ScannerService,
  ) {}

  @Post('sommelier')
  ask(@CurrentUserId() userId: string, @Body() dto: AskDto) {
    return this.sommelier.ask(userId, dto.question);
  }

  @Post('scan/bottle')
  scanBottle(@Body() dto: ScanDto) {
    return this.scanner.scanBottle(dto.image);
  }

  @Post('scan/case')
  scanCase(@Body() dto: ScanDto) {
    return this.scanner.scanCase(dto.image);
  }

  @Post('scan/invoice')
  scanInvoice(@Body() dto: ScanDto) {
    return this.scanner.scanInvoice(dto.image);
  }
}
