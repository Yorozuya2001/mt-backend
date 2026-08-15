import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @ValidateIf((dto: CreateUserDto) => dto.role === 'ADMIN')
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
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
  @IsIn(['CLIENT', 'ADMIN'], {
    message: 'El rol debe ser CLIENT o ADMIN',
  })
  role?: 'CLIENT' | 'ADMIN';

  @IsOptional()
  @IsBoolean()
  isWholesale?: boolean;
}
