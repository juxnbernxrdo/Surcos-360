import { Module } from '@nestjs/common';
import { StudentsService } from './services/students.service';
import { StudentAnalyticsService } from './services/student-analytics.service';
import { StudentRepresentativeService } from './services/student-representative.service';
import { StudentImportService } from './services/student-import.service';
import { StudentsController } from './students.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, LedgerModule, AuthModule],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    StudentAnalyticsService,
    StudentRepresentativeService,
    StudentImportService,
  ],
  exports: [
    StudentsService,
    StudentAnalyticsService,
    StudentRepresentativeService,
    StudentImportService,
  ],
})
export class StudentsModule {}
