import { Controller, Get, Param, Query } from '@nestjs/common';
import { WinesService } from './wines.service';

@Controller('wines')
export class WinesController {
  constructor(private readonly wines: WinesService) {}

  @Get()
  search(@Query('q') q = '') {
    return this.wines.search(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wines.findOne(id);
  }
}
