import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCellarDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCellarDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateZoneDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class CreateRackDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  columns!: number;

  @IsInt()
  @Min(1)
  rows!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  depth?: number;
}
