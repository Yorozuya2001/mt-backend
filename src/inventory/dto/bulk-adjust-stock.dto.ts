import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BulkProductIdsDto } from './bulk-product-ids.dto';

export const BULK_STOCK_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;
export type BulkStockType = (typeof BULK_STOCK_TYPES)[number];

export class BulkAdjustStockDto extends BulkProductIdsDto {
  @IsIn(BULK_STOCK_TYPES)
  type: BulkStockType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
