import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreateRemitoItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ValidateIf((dto: CreateRemitoItemDto) => !dto.productId)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres' })
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Max(9999)
  quantity: number;

  @ValidateIf((dto: CreateRemitoItemDto) => !dto.productId)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

export class CreateRemitoDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsEnum(PaymentMethod, {
    message: 'El método de pago debe ser EFECTIVO, TRANSFERENCIA o TARJETA',
  })
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'El remito debe tener al menos un ítem' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateRemitoItemDto)
  items: CreateRemitoItemDto[];
}
