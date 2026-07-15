import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CellarsService } from './cellars.service';
import { CreateCellarDto, UpdateCellarDto, CreateZoneDto, CreateRackDto } from './dto';
import { CurrentUserId } from '../common/current-user.decorator';

@Controller('cellars')
export class CellarsController {
  constructor(private readonly cellars: CellarsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.cellars.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cellars.findOne(id);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateCellarDto) {
    return this.cellars.create(userId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCellarDto) {
    return this.cellars.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cellars.remove(id);
  }

  @Post(':id/zones')
  addZone(@Param('id') id: string, @Body() dto: CreateZoneDto) {
    return this.cellars.addZone(id, dto);
  }

  @Post('zones/:zoneId/racks')
  addRack(@Param('zoneId') zoneId: string, @Body() dto: CreateRackDto) {
    return this.cellars.addRack(zoneId, dto);
  }
}
