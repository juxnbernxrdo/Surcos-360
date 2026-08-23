import { IsOptional, IsDateString } from 'class-validator';

export class StudentStatsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
