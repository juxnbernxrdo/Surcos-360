import { Module } from '@nestjs/common';
import { AgroredService } from './agrored.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [AgroredService],
  exports: [AgroredService],
})
export class AgroredModule {}
