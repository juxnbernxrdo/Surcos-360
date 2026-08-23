import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { LedgerService } from '../ledger.service';
import { FinancialAccountsService } from '../services/financial-accounts.service';
import {
  CreateTransactionDto,
  ReverseTransactionDto,
  StudentDepositDto,
  StudentWithdrawalDto,
  QueryTransactionsDto,
  CreateLedgerAccountDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgPermissionsGuard } from '../../auth/guards/org-permissions.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserType, MembershipStatus } from '@prisma/client';

interface LedgerRequestUser {
  institutionalPerson?: { userType?: UserType };
  memberships?: Array<{
    organizationId: string;
    status?: MembershipStatus;
  }>;
}

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly accountsService: FinancialAccountsService,
  ) {}

  /**
   * Resuelve las organizaciones accesibles para el actor.
   * AUTHORITY tiene alcance global (undefined); el resto se limita a sus
   * membresías activas.
   */
  private resolveScopedOrgIds(
    req: Request & { user?: LedgerRequestUser },
  ): string[] | undefined {
    const user = req.user;
    const person = user?.institutionalPerson;
    if (!user || !person) {
      throw new ForbiddenException('Identidad del usuario no encontrada.');
    }
    if (person.userType === UserType.AUTHORITY) {
      return undefined;
    }
    const orgIds = (user.memberships || [])
      .filter(
        (m) => m.status === undefined || m.status === MembershipStatus.ACTIVE,
      )
      .map((m) => m.organizationId);
    if (orgIds.length === 0) {
      throw new ForbiddenException(
        'El usuario no pertenece a ninguna organización (Tenant Context).',
      );
    }
    return orgIds;
  }

  /**
   * Posts an arbitrary double-entry financial transaction (§5, §7.3 PRD v1.0).
   * Restricted to Authorities and System Administrators.
   */
  @Post('transactions')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async createTransaction(
    @Body() dto: CreateTransactionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ledgerService.createTransaction({
      ...dto,
      actorId,
    });
  }

  /**
   * Reverses an existing financial transaction with an immutable reversing entry (§18, §19 PRD v1.0).
   */
  @Post('reversals/:id')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async reverseTransaction(
    @Param('id') transactionId: string,
    @Body() dto: ReverseTransactionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ledgerService.reverseTransaction(transactionId, dto, actorId);
  }

  /**
   * Deposits funds into a student savings account (§7.1, §8 PRD v1.0).
   * Restricted to Authorities (Surcos Saving Administration).
   */
  @Post('students/:studentAccountId/deposit')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async depositToStudentAccount(
    @Param('studentAccountId') studentAccountId: string,
    @Body() dto: StudentDepositDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ledgerService.depositToStudentAccount(
      studentAccountId,
      dto,
      actorId,
    );
  }

  /**
   * Withdraws funds from a student savings account (§7.1, §8 PRD v1.0).
   * Restricted to Authorities (Surcos Saving Administration).
   */
  @Post('students/:studentAccountId/withdraw')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async withdrawFromStudentAccount(
    @Param('studentAccountId') studentAccountId: string,
    @Body() dto: StudentWithdrawalDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ledgerService.withdrawFromStudentAccount(
      studentAccountId,
      dto,
      actorId,
    );
  }

  /**
   * Lists General Ledger transactions with pagination, date ranges, and filters (§29 PRD v1.0).
   */
  @Get('transactions')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findTransactions(
    @Query() query: QueryTransactionsDto,
    @Req() req: Request,
  ) {
    const scopedOrgIds = this.resolveScopedOrgIds(req);
    return this.ledgerService.findTransactions(query, undefined, scopedOrgIds);
  }

  /**
   * Retrieves single transaction by ID with full double-entry details.
   */
  @Get('transactions/:id')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findTransactionById(@Param('id') id: string, @Req() req: Request) {
    const scopedOrgIds = this.resolveScopedOrgIds(req);
    return this.ledgerService.findTransactionById(id, undefined, scopedOrgIds);
  }

  /**
   * Lists ledger accounts for an organization with real-time derived balances.
   */
  @Get('organizations/:orgId/accounts')
  async getOrganizationAccounts(
    @Param('orgId') orgId: string,
    @Req() req: Request,
  ) {
    const scopedOrgIds = this.resolveScopedOrgIds(req);
    return this.accountsService.getOrganizationAccounts(orgId, scopedOrgIds);
  }

  /**
   * Creates a new custom ledger account for an organization.
   */
  @Post('organizations/:orgId/accounts')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async createLedgerAccount(
    @Param('orgId') orgId: string,
    @Body() dto: CreateLedgerAccountDto,
    @Req() req: Request,
  ) {
    const scopedOrgIds = this.resolveScopedOrgIds(req);
    return this.accountsService.createLedgerAccount(orgId, dto, scopedOrgIds);
  }

  /**
   * Retrieves account statement / detailed journal for a specific account.
   */
  @Get('accounts/:id/statement')
  async getAccountStatement(
    @Param('id') accountId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: Request,
  ) {
    const scopedOrgIds = this.resolveScopedOrgIds(req as Request);
    return this.accountsService.getAccountStatement(
      accountId,
      { startDate, endDate },
      scopedOrgIds,
    );
  }
}
