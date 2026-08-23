import { IsOptional, IsDateString, IsString } from 'class-validator';

export class FinancialReportQueryDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate debe ser una fecha ISO válida (YYYY-MM-DD).' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'endDate debe ser una fecha ISO válida (YYYY-MM-DD).' },
  )
  endDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'asOfDate debe ser una fecha ISO válida (YYYY-MM-DD).' },
  )
  asOfDate?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
