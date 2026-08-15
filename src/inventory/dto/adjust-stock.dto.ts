import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/client';

export class AdjustStockDto {
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
