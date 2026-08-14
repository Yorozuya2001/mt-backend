import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export enum RemitoSortBy {
  CREATED_AT = 'createdAt',
  NUMBER = 'number',
  TOTAL = 'total',
}

export enum RemitoSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListRemitosQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  finalConsumer?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasClient?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(RemitoSortBy)
  sortBy?: RemitoSortBy = RemitoSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(RemitoSortOrder)
  sortOrder?: RemitoSortOrder = RemitoSortOrder.DESC;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
