import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BottlesService } from './bottles.service';
import {
  CreateBottleDto,
  UpdateBottleDto,
  ConsumeBottleDto,
  MoveBottleDto,
  ListBottlesQuery,
} from './dto';

@Controller('bottles')
export class BottlesController {
  constructor(private readonly bottles: BottlesService) {}

  @Get()
  list(@Query() query: ListBottlesQuery) {
    return this.bottles.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bottles.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBottleDto) {
    return this.bottles.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBottleDto) {
    return this.bottles.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bottles.remove(id);
  }

  @Post(':id/consume')
  consume(@Param('id') id: string, @Body() dto: ConsumeBottleDto) {
    return this.bottles.consume(id, dto);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() dto: MoveBottleDto) {
    return this.bottles.move(id, dto);
  }

  @Post(':id/revaluate')
  revaluate(@Param('id') id: string) {
    return this.bottles.revaluate(id);
  }
}
