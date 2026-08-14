import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidRemitoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
