import { IsEnum, IsOptional } from 'class-validator';
import type { ImportMode } from '../import/import-result.type';

export class ImportOptionsDto {
  @IsOptional()
  @IsEnum(['merge', 'replace'])
  mode?: ImportMode = 'merge';
}
