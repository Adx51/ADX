import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateBottleDto {
  @IsUUID()
  cellarId!: string;

  // Wine identity (a canonical Wine is found-or-created + AI-enriched)
  @IsString()
  domain!: string;

  @IsOptional()
  @IsString()
  cuvee?: string;

  @IsOptional()
  @IsInt()
  vintage?: number;

  @IsOptional()
  @IsString()
  appellation?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  country?: string;

  // Inventory
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  volumeMl?: number;

  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  purchasePlace?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  personalRating?: number;
}

export class UpdateBottleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  purchasePlace?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  personalRating?: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class ConsumeBottleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  occasion?: string;
}

export class MoveBottleDto {
  @IsUUID()
  positionId!: string;
}

export class ListBottlesQuery {
  @IsOptional()
  @IsUUID()
  cellarId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
