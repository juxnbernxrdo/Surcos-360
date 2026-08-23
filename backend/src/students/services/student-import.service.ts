import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from './students.service';
import { BulkImportStudentsDto } from '../dto/create-student.dto';

@Injectable()
export class StudentImportService {
  private readonly logger = new Logger(StudentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  /**
   * Bulk imports students with pre-validation, deduplication and detailed reporting (§8 & §29 PRD / prompt).
   */
  async bulkImport(dto: BulkImportStudentsDto, actorId: string) {
    const results: Array<{
      index: number;
      email: string;
      institutionalCode: string;
      status: 'SUCCESS' | 'FAILED';
      studentId?: string;
      accountNumber?: string;
      registrationToken?: string;
      error?: string;
    }> = [];

    const seenEmails = new Set<string>();
    const seenCodes = new Set<string>();

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dto.students.length; i++) {
      const studentInput = dto.students[i];
      const normEmail = studentInput.email.toLowerCase().trim();
      const normCode = studentInput.institutionalCode.trim().toUpperCase();

      // 1. Check in-batch duplicate email
      if (seenEmails.has(normEmail)) {
        results.push({
          index: i + 1,
          email: studentInput.email,
          institutionalCode: studentInput.institutionalCode,
          status: 'FAILED',
          error: `Correo duplicado '${studentInput.email}' en el lote de importación.`,
        });
        failedCount++;
        continue;
      }

      // 2. Check in-batch duplicate institutional code
      if (seenCodes.has(normCode)) {
        results.push({
          index: i + 1,
          email: studentInput.email,
          institutionalCode: studentInput.institutionalCode,
          status: 'FAILED',
          error: `Código institucional duplicado '${studentInput.institutionalCode}' en el lote.`,
        });
        failedCount++;
        continue;
      }

      seenEmails.add(normEmail);
      seenCodes.add(normCode);

      // 3. Process single student creation atomically
      try {
        const created = await this.studentsService.createStudent(
          studentInput,
          actorId,
        );
        results.push({
          index: i + 1,
          email: studentInput.email,
          institutionalCode: studentInput.institutionalCode,
          status: 'SUCCESS',
          studentId: created.student.id,
          accountNumber: created.studentAccount.accountNumber,
          registrationToken: created.registrationToken,
        });
        successCount++;
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Error en proceso de importación';
        results.push({
          index: i + 1,
          email: studentInput.email,
          institutionalCode: studentInput.institutionalCode,
          status: 'FAILED',
          error: errorMsg,
        });
        failedCount++;
      }
    }

    // 4. Batch Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_IMPORTED',
          entity: 'InstitutionalPerson',
          entityId: 'BULK_IMPORT_BATCH',
          newState: {
            totalStudents: dto.students.length,
            successCount,
            failedCount,
          },
        },
      });
    } catch (auditErr) {
      this.logger.warn(`Failed to write bulk import audit log: ${auditErr}`);
    }

    return {
      total: dto.students.length,
      successCount,
      failedCount,
      results,
    };
  }
}
