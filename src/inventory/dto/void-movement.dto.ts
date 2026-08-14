import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidMovementDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
