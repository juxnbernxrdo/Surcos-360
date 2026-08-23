import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerService } from './ledger.service';
import { FinancialAccountsService } from './services/financial-accounts.service';
import { FinancialReportsService } from './services/financial-reports.service';
import { LedgerController } from './controllers/ledger.controller';
import { FinancialReportsController } from './controllers/financial-reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LedgerController, FinancialReportsController],
  providers: [LedgerService, FinancialAccountsService, FinancialReportsService],
  exports: [LedgerService, FinancialAccountsService, FinancialReportsService],
})
export class LedgerModule {}
