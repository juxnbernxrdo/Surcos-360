/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import {
  UserType,
  InstitutionStatus,
  OrganizationRole,
  TokenType,
  TokenStatus,
  EntryDirection,
  TransactionType,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('StudentsController (e2e)', () => {
  let app: INestApplication;

  let currentAuthUser: {
    id?: string;
    userId?: string;
    email?: string;
    institutionalPerson?: {
      id: string;
      userType: UserType;
      status: InstitutionStatus;
    };
    memberships?: Array<{
      organizationId: string;
      role: OrganizationRole;
    }>;
  } | null = null;

  const mockPrismaService = {
    institutionalPerson: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    studentAccount: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ledgerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    registrationToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (!currentAuthUser) {
            return false;
          }
          req.user = {
            id: currentAuthUser.id,
            userId: currentAuthUser.userId,
            userType: currentAuthUser.institutionalPerson?.userType,
            institutionalPerson: currentAuthUser.institutionalPerson,
            memberships: currentAuthUser.memberships || [],
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to Authority admin user
    currentAuthUser = {
      id: 'actor-admin-1',
      userId: 'user-admin-1',
      email: 'admin@surcos.edu.ec',
      institutionalPerson: {
        id: 'actor-admin-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      },
      memberships: [],
    };
  });

  describe('POST /api/v1/students', () => {
    it('should validate DTO and reject missing mandatory fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .send({
          firstName: 'Juan',
        })
        .expect(400);
    });

    it('should reject negative initial balance with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .send({
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@test.com',
          institutionalCode: 'STU001',
          course: '3ro BGU',
          initialBalance: -10,
        })
        .expect(400);
    });

    it('should successfully create student and return initial balance + token', async () => {
      mockPrismaService.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrismaService.institutionalPerson.create.mockResolvedValue({
        id: 'p-1',
        firstName: 'Carlos',
        lastName: 'Mendoza',
        email: 'carlos@surcos.edu.ec',
        institutionalCode: 'EST-2026-09',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      });
      mockPrismaService.studentProfile.create.mockResolvedValue({
        id: 'r-1',
        course: '1ro BGU',
      });
      mockPrismaService.customer.create.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.studentAccount.create.mockResolvedValue({
        id: 'acc-1',
        accountNumber: 'ACC-STU-999-111',
      });
      mockPrismaService.registrationToken.create.mockResolvedValue({
        id: 'tok-1',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/students')
        .send({
          firstName: 'Carlos',
          lastName: 'Mendoza',
          email: 'carlos@surcos.edu.ec',
          institutionalCode: 'EST-2026-09',
          course: '1ro BGU',
          initialBalance: 0,
        })
        .expect(201);

      expect(res.body.student.id).toBe('p-1');
      expect(res.body.studentAccount.accountNumber).toBe('ACC-STU-999-111');
      expect(res.body.registrationToken).toBeDefined();
    });

    it('should forbid non-admin/non-teacher student from calling POST /api/v1/students', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      await request(app.getHttpServer())
        .post('/api/v1/students')
        .send({
          firstName: 'Unauthorized',
          lastName: 'Attempt',
          email: 'unauth@test.com',
          institutionalCode: 'STU999',
          course: '3ro BGU',
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/students/import', () => {
    it('should bulk import students and report results', async () => {
      mockPrismaService.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrismaService.institutionalPerson.create.mockResolvedValue({
        id: 'p-bulk-1',
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@surcos.edu.ec',
        institutionalCode: 'EST-2026-01',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      });
      mockPrismaService.studentProfile.create.mockResolvedValue({ id: 'r-1', course: '2do BGU' });
      mockPrismaService.customer.create.mockResolvedValue({ id: 'c-1' });
      mockPrismaService.studentAccount.create.mockResolvedValue({ id: 'acc-1', accountNumber: 'ACC-1' });
      mockPrismaService.registrationToken.create.mockResolvedValue({ id: 'tok-1' });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/students/import')
        .send({
          students: [
            {
              firstName: 'Ana',
              lastName: 'Silva',
              email: 'ana@surcos.edu.ec',
              institutionalCode: 'EST-2026-01',
              course: '2do BGU',
            },
          ],
        })
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.successCount).toBe(1);
      expect(res.body.results[0].status).toBe('SUCCESS');
    });
  });

  describe('GET /api/v1/students/me/dashboard', () => {
    it('should allow student to fetch their personal dashboard', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'student@surcos.edu.ec',
        institutionalCode: 'EST-001',
        status: InstitutionStatus.ACTIVE,
        studentProfile: { course: '3ro BGU', tutor: 'Prof. Gomez' },
        studentAccount: { id: 'acc-stu-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me/dashboard')
        .expect(200);

      expect(res.body.student.firstName).toBe('Juan');
      expect(res.body.financials.accountNumber).toBe('ACC-STU-001');
    });
  });

  describe('GET /api/v1/students/me/statistics', () => {
    it('should allow student to fetch spending statistics', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        studentAccount: { id: 'acc-stu-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me/statistics')
        .expect(200);

      expect(res.body.accountNumber).toBe('ACC-STU-001');
      expect(res.body.summary).toBeDefined();
      expect(res.body.pymeBreakdown).toBeDefined();
    });
  });

  describe('GET /api/v1/students/me/reports/summary', () => {
    it('should generate financial summary report for student', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'student@surcos.edu.ec',
        institutionalCode: 'EST-001',
        studentProfile: { course: '3ro BGU', tutor: 'Prof. Gomez' },
        studentAccount: { id: 'acc-stu-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me/reports/summary')
        .expect(200);

      expect(res.body.reportId).toBeDefined();
      expect(res.body.financialSummary).toBeDefined();
    });
  });

  describe('Representative Endpoints', () => {
    it('GET /api/v1/students/me/representative should return linked representative status', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        studentProfile: {
          representative: {
            id: 'rep-1',
            phoneNumber: '0999999999',
            institutionalPerson: {
              id: 'rep-p-1',
              firstName: 'Carlos',
              lastName: 'Pérez',
              email: 'carlos@gmail.com',
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me/representative')
        .expect(200);

      expect(res.body.hasRepresentative).toBe(true);
      expect(res.body.representative.firstName).toBe('Carlos');
    });

    it('POST /api/v1/students/me/representative/invite should reject if student already has a representative', async () => {
      currentAuthUser = {
        id: 'student-id-1',
        userId: 'user-student-1',
        email: 'student@surcos.edu.ec',
        institutionalPerson: {
          id: 'student-id-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        studentProfile: {
          representativeId: 'already-linked-rep-id',
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/students/me/representative/invite')
        .send({
          parentEmail: 'parent@gmail.com',
        })
        .expect(409);
    });

    it('DELETE /api/v1/students/:id/representative should allow authority to unlink representative', async () => {
      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        userType: UserType.STUDENT,
        studentProfile: {
          id: 'sp-1',
          representativeId: 'rep-1',
        },
      });
      mockPrismaService.studentProfile.update.mockResolvedValue({ id: 'sp-1' });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const res = await request(app.getHttpServer())
        .delete('/api/v1/students/student-1/representative')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/students/lookup', () => {
    it('should lookup active student for cashier POS', async () => {
      mockPrismaService.institutionalPerson.findFirst.mockResolvedValue({
        id: 'p-1',
        firstName: 'Mateo',
        lastName: 'Silva',
        email: 'mateo@colegiosurcos.edu.ec',
        institutionalCode: 'STU100',
        studentProfile: { course: '3ro BGU' },
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-STU-100' },
        customers: [{ id: 'cust-100' }],
      });
      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/lookup?code=STU100')
        .expect(200);

      expect(res.body.fullName).toBe('Mateo Silva');
      expect(res.body.accountNumber).toBe('ACC-STU-100');
    });
  });

  describe('PATCH /api/v1/students/:id/academic', () => {
    it('should allow authority to update course and tutor', async () => {
      mockPrismaService.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
        studentProfile: { id: 'sp-1', course: '1ro BGU', tutor: 'Prof A' },
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-1' },
      });
      mockPrismaService.studentProfile.upsert.mockResolvedValue({ id: 'sp-1' });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/p-1/academic')
        .send({
          course: '2do BGU',
          tutor: 'Prof B',
        })
        .expect(200);

      expect(res.body.id).toBe('p-1');
    });
  });

  describe('Cross-Tenant Isolation (by-id endpoints)', () => {
    const crossTenantStudent = {
      id: 'stu-tenant-b',
      institutionId: 'inst-B',
      userType: UserType.STUDENT,
      status: InstitutionStatus.ACTIVE,
      firstName: 'Alien',
      lastName: 'Tenant',
      email: 'tenant-b@surcos.edu.ec',
      institutionalCode: 'TENB-001',
      studentProfile: { id: 'sp-b', course: '3ro BGU' },
      studentAccount: { id: 'acc-b', accountNumber: 'ACC-TENB-1' },
    };

    it('GET /students/:id hides cross-tenant students (404)', async () => {
      currentAuthUser = {
        id: 'teacher-a',
        userId: 'user-teacher-a',
        institutionalPerson: {
          id: 'teacher-a',
          userType: UserType.TEACHER,
          status: InstitutionStatus.ACTIVE,
          institutionId: 'inst-A',
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce(
        crossTenantStudent,
      );

      await request(app.getHttpServer())
        .get('/api/v1/students/stu-tenant-b')
        .expect(404);
    });

    it('PATCH /students/:id rejects cross-tenant update (404)', async () => {
      currentAuthUser = {
        id: 'teacher-a',
        userId: 'user-teacher-a',
        institutionalPerson: {
          id: 'teacher-a',
          userType: UserType.TEACHER,
          status: InstitutionStatus.ACTIVE,
          institutionId: 'inst-A',
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce(
        crossTenantStudent,
      );

      await request(app.getHttpServer())
        .patch('/api/v1/students/stu-tenant-b')
        .send({ firstName: 'Hacked' })
        .expect(404);
    });

    it('PATCH /students/:id/status is AUTHORITY-only (403 for TEACHER)', async () => {
      currentAuthUser = {
        id: 'teacher-a',
        userId: 'user-teacher-a',
        institutionalPerson: {
          id: 'teacher-a',
          userType: UserType.TEACHER,
          status: InstitutionStatus.ACTIVE,
          institutionId: 'inst-A',
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce(
        crossTenantStudent,
      );

      await request(app.getHttpServer())
        .patch('/api/v1/students/stu-tenant-b/status')
        .send({ status: 'INACTIVE', reason: 'hack' })
        .expect(403);
    });

    it('same-institution TEACHER can read the student (200)', async () => {
      currentAuthUser = {
        id: 'teacher-b',
        userId: 'user-teacher-b',
        institutionalPerson: {
          id: 'teacher-b',
          userType: UserType.TEACHER,
          status: InstitutionStatus.ACTIVE,
          institutionId: 'inst-B',
        },
        memberships: [],
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce({
        ...crossTenantStudent,
        studentProfile: { id: 'sp-b', course: '3ro BGU' },
        studentAccount: { id: 'acc-b', accountNumber: 'ACC-TENB-1' },
      });
      mockPrismaService.ledgerEntry.findMany.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/stu-tenant-b')
        .expect(200);

      expect(res.body.id).toBe('stu-tenant-b');
    });
  });
});
