import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RemitoReturnItemDto {
  @IsUUID()
  remitoItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateRemitoReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RemitoReturnItemDto)
  items!: RemitoReturnItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
