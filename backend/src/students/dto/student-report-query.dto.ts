import { IsOptional, IsDateString } from 'class-validator';

export class StudentReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
