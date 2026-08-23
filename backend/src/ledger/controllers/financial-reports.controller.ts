import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { FinancialReportsService } from '../services/financial-reports.service';
import { FinancialReportQueryDto } from '../dto/financial-report-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgPermissionsGuard } from '../../auth/guards/org-permissions.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OrgPermissions } from '../../auth/decorators/org-permissions.decorator';
import { UserType, OrganizationRole } from '@prisma/client';

@Controller('ledger/reports')
@UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
export class FinancialReportsController {
  constructor(
    private readonly financialReportsService: FinancialReportsService,
  ) {}

  /**
   * Trial Balance report (Balance de Comprobación) (§28 PRD v1.0).
   * Verifies mathematical equilibrium across all accounts: SUM(Debits) == SUM(Credits).
   */
  @Get('trial-balance')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getTrialBalance(@Query() query: FinancialReportQueryDto) {
    return this.financialReportsService.getTrialBalance(
      query.organizationId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * Income Statement report (Estado de Resultados / P&L) for an Organization.
   */
  @Get('organizations/:orgId/income-statement')
  @OrgPermissions('reports.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async getIncomeStatement(
    @Param('orgId') orgId: string,
    @Query() query: FinancialReportQueryDto,
  ) {
    return this.financialReportsService.getIncomeStatement(
      orgId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * Balance Sheet report (Balance General) for an Organization.
   */
  @Get('organizations/:orgId/balance-sheet')
  @OrgPermissions('reports.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async getBalanceSheet(
    @Param('orgId') orgId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.financialReportsService.getBalanceSheet(orgId, asOfDate);
  }

  /**
   * Consolidated Governance Overview for Surcos Saving Authorities (§7.1, §7.2 PRD v1.0).
   */
  @Get('institutional-overview')
  @Roles(UserType.AUTHORITY)
  async getInstitutionalOverview(@Query('asOfDate') asOfDate?: string) {
    return this.financialReportsService.getInstitutionalOverview(asOfDate);
  }
}
