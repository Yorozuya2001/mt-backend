import { IsDateString, IsOptional } from 'class-validator';

export class DailyReportQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
