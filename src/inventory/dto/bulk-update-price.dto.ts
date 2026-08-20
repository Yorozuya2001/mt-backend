import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { BulkProductIdsDto } from './bulk-product-ids.dto';

export const PRICE_DIRECTIONS = ['increase', 'decrease'] as const;
export type PriceDirection = (typeof PRICE_DIRECTIONS)[number];

export class BulkUpdatePriceDto extends BulkProductIdsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  percent: number;

  @IsIn(PRICE_DIRECTIONS)
  direction: PriceDirection;

  @IsOptional()
  @IsBoolean()
  applyToWholesale?: boolean;
}
