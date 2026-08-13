import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '' && value != null)
  @IsString()
  @Matches(/^\d{7,10}$/, {
    message: 'El DNI debe tener entre 7 y 10 dígitos',
  })
  dni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locality?: string;

  @IsOptional()
  @IsBoolean()
  isWholesale?: boolean;
}
