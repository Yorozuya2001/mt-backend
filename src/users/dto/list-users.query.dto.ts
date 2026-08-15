import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
