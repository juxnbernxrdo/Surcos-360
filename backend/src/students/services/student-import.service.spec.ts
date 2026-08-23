/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { StudentImportService } from './student-import.service';
import { StudentsService } from './students.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('StudentImportService', () => {
  let service: StudentImportService;
  let studentsService: StudentsService;
  let prisma: PrismaService;

  const mockStudentsService = {
    createStudent: jest.fn(),
  };

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentImportService,
        { provide: StudentsService, useValue: mockStudentsService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StudentImportService>(StudentImportService);
    studentsService = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('bulkImport', () => {
    it('should import valid students and handle in-batch duplicates and database errors cleanly', async () => {
      mockStudentsService.createStudent
        .mockResolvedValueOnce({
          student: { id: 's-1' },
          studentAccount: { accountNumber: 'ACC-1' },
          registrationToken: 'tok-1',
        })
        .mockRejectedValueOnce(
          new ConflictException('Correo institucional ya registrado'),
        );

      const result = await service.bulkImport(
        {
          students: [
            {
              firstName: 'Valid',
              lastName: 'Student 1',
              email: 'valid1_est@colegiosurcos.edu.ec',
              institutionalCode: 'STU001',
              course: '3ro BGU',
            },
            {
              firstName: 'Duplicate',
              lastName: 'Student 2',
              email: 'duplicate_est@colegiosurcos.edu.ec',
              institutionalCode: 'STU002',
              course: '3ro BGU',
            },
            {
              firstName: 'InBatch',
              lastName: 'Duplicate',
              email: 'valid1_est@colegiosurcos.edu.ec', // Duplicate email in batch
              institutionalCode: 'STU003',
              course: '3ro BGU',
            },
            {
              firstName: 'InBatchCode',
              lastName: 'Duplicate',
              email: 'other_est@colegiosurcos.edu.ec',
              institutionalCode: 'STU001', // Duplicate code in batch
              course: '3ro BGU',
            },
          ],
        },
        'authority-actor',
      );

      expect(result.total).toBe(4);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(3);
      expect(result.results[0].status).toBe('SUCCESS');
      expect(result.results[1].status).toBe('FAILED');
      expect(result.results[2].status).toBe('FAILED');
      expect(result.results[2].error).toContain('Correo duplicado');
      expect(result.results[3].status).toBe('FAILED');
      expect(result.results[3].error).toContain('Código institucional duplicado');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STUDENT_IMPORTED',
          }),
        }),
      );
    });
  });
});
