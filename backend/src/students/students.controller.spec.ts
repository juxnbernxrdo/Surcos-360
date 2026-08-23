/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { StudentsController } from './students.controller';
import { StudentsService } from './services/students.service';
import { StudentAnalyticsService } from './services/student-analytics.service';
import { StudentRepresentativeService } from './services/student-representative.service';
import { StudentImportService } from './services/student-import.service';
import { Reflector } from '@nestjs/core';
import { InstitutionStatus, UserType } from '@prisma/client';

describe('StudentsController', () => {
  let controller: StudentsController;
  let studentsService: StudentsService;
  let studentAnalyticsService: StudentAnalyticsService;
  let studentRepresentativeService: StudentRepresentativeService;
  let studentImportService: StudentImportService;

  const mockStudentsService = {
    createStudent: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    getStudentProfile: jest.fn(),
    updateStudent: jest.fn(),
    updateAcademicData: jest.fn(),
    updateStatus: jest.fn(),
    lookupStudent: jest.fn(),
  };

  const mockStudentAnalyticsService = {
    getStudentDashboard: jest.fn(),
    getStudentStatement: jest.fn(),
    getStudentStatistics: jest.fn(),
    getStudentReport: jest.fn(),
  };

  const mockStudentRepresentativeService = {
    getStudentRepresentative: jest.fn(),
    createRepresentativeInvitation: jest.fn(),
    unlinkRepresentative: jest.fn(),
  };

  const mockStudentImportService = {
    bulkImport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: StudentsService, useValue: mockStudentsService },
        {
          provide: StudentAnalyticsService,
          useValue: mockStudentAnalyticsService,
        },
        {
          provide: StudentRepresentativeService,
          useValue: mockStudentRepresentativeService,
        },
        {
          provide: StudentImportService,
          useValue: mockStudentImportService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
    studentsService = module.get<StudentsService>(StudentsService);
    studentAnalyticsService = module.get<StudentAnalyticsService>(
      StudentAnalyticsService,
    );
    studentRepresentativeService = module.get<StudentRepresentativeService>(
      StudentRepresentativeService,
    );
    studentImportService = module.get<StudentImportService>(
      StudentImportService,
    );

    jest.clearAllMocks();
  });

  describe('Self-Service Endpoints', () => {
    it('getMyDashboard should call analytics service with student identifier', async () => {
      mockStudentAnalyticsService.getStudentDashboard.mockResolvedValue({
        student: { firstName: 'Juan' },
        financials: { currentBalance: 75 },
      });

      const res = await controller.getMyDashboard('person-1', 'uid-1');
      expect(mockStudentAnalyticsService.getStudentDashboard).toHaveBeenCalledWith(
        'person-1',
      );
      expect(res.student.firstName).toBe('Juan');
    });

    it('getMyStatement should call analytics service with query', async () => {
      mockStudentAnalyticsService.getStudentStatement.mockResolvedValue({
        data: [],
        total: 0,
      });

      const res = await controller.getMyStatement('person-1', 'uid-1', {
        page: 1,
        limit: 10,
      });
      expect(mockStudentAnalyticsService.getStudentStatement).toHaveBeenCalledWith(
        'person-1',
        { page: 1, limit: 10 },
      );
    });

    it('getMyStatistics should call analytics service', async () => {
      mockStudentAnalyticsService.getStudentStatistics.mockResolvedValue({
        summary: { totalExpenses: 25 },
      });

      const res = await controller.getMyStatistics('person-1', 'uid-1', {});
      expect(mockStudentAnalyticsService.getStudentStatistics).toHaveBeenCalledWith(
        'person-1',
        {},
      );
    });

    it('getMyReportSummary should call analytics service for formal report', async () => {
      mockStudentAnalyticsService.getStudentReport.mockResolvedValue({
        reportId: 'REP-001',
      });

      const res = await controller.getMyReportSummary('person-1', 'uid-1', {
        format: 'summary',
      });
      expect(mockStudentAnalyticsService.getStudentReport).toHaveBeenCalledWith(
        'person-1',
        { format: 'summary' },
      );
    });

    it('getMyRepresentative should return representative details', async () => {
      mockStudentRepresentativeService.getStudentRepresentative.mockResolvedValue({
        hasRepresentative: true,
      });

      const res = await controller.getMyRepresentative('person-1', 'uid-1');
      expect(
        mockStudentRepresentativeService.getStudentRepresentative,
      ).toHaveBeenCalledWith('person-1');
    });

    it('inviteMyRepresentative should generate single-use invitation', async () => {
      mockStudentRepresentativeService.createRepresentativeInvitation.mockResolvedValue(
        {
          token: 'tok-abc',
        },
      );

      const res = await controller.inviteMyRepresentative(
        'person-1',
        'uid-1',
        { parentEmail: 'parent@gmail.com' },
      );
      expect(
        mockStudentRepresentativeService.createRepresentativeInvitation,
      ).toHaveBeenCalledWith(
        'person-1',
        { parentEmail: 'parent@gmail.com' },
        'person-1',
      );
      expect(res.token).toBe('tok-abc');
    });
  });

  describe('Administrative Endpoints', () => {
    it('create should call studentsService.createStudent', async () => {
      mockStudentsService.createStudent.mockResolvedValue({
        student: { id: 's-1' },
      });

      const dto = {
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: 'carlos_est@colegiosurcos.edu.ec',
        institutionalCode: 'STU010',
        course: '1ro BGU',
      };

      const res = await controller.create(dto, 'admin-id');
      expect(mockStudentsService.createStudent).toHaveBeenCalledWith(
        dto,
        'admin-id',
      );
    });

    it('bulkImport should delegate to studentImportService', async () => {
      mockStudentImportService.bulkImport.mockResolvedValue({
        total: 1,
        successCount: 1,
      });

      const res = await controller.bulkImport(
        {
          students: [
            {
              firstName: 'A',
              lastName: 'B',
              email: 'a_est@colegiosurcos.edu.ec',
              institutionalCode: 'STU01',
              course: '3ro BGU',
            },
          ],
        },
        'admin-id',
      );

      expect(mockStudentImportService.bulkImport).toHaveBeenCalled();
    });

    it('updateAcademic should call studentsService.updateAcademicData', async () => {
      mockStudentsService.updateAcademicData.mockResolvedValue({
        id: 's-1',
        course: '3ro BGU "B"',
      });

      const mockActor = {
        id: 'admin-id',
        userType: 'AUTHORITY',
        institutionId: 'default-institution',
      };

      const res = await controller.updateAcademic(
        's-1',
        { course: '3ro BGU "B"' },
        'admin-id',
        mockActor,
      );
      expect(mockStudentsService.updateAcademicData).toHaveBeenCalledWith(
        's-1',
        { course: '3ro BGU "B"' },
        'admin-id',
        mockActor,
      );
    });

    it('unlinkRepresentative should unlink representative', async () => {
      mockStudentRepresentativeService.unlinkRepresentative.mockResolvedValue({
        success: true,
      });

      const res = await controller.unlinkRepresentative('s-1', 'admin-id');
      expect(
        mockStudentRepresentativeService.unlinkRepresentative,
      ).toHaveBeenCalledWith('s-1', 'admin-id');
    });

    it('lookupStudent should lookup active student for POS', async () => {
      mockStudentsService.lookupStudent.mockResolvedValue({
        fullName: 'Mateo Silva',
        currentBalance: 15.0,
      });

      const res = await controller.lookupStudent({ code: 'STU100' });
      expect(mockStudentsService.lookupStudent).toHaveBeenCalledWith({
        code: 'STU100',
      });
      expect(res.fullName).toBe('Mateo Silva');
    });
  });
});
