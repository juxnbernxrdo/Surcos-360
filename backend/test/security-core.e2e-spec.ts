/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseAuthService } from '../src/auth/services/supabase-auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UserType, InstitutionStatus, OrganizationRole } from '@prisma/client';

describe('Security & Governance Core (e2e)', () => {
  let app: INestApplication;
  let currentUserContext: any = {
    id: 'actor-student-1',
    userId: 'user-student-1',
    userType: UserType.STUDENT,
    status: InstitutionStatus.ACTIVE,
  };

  const mockPrismaService = {
    institutionalPerson: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    idempotencyKey: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    registrationToken: {
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockSupabaseAuthService = {
    resetPasswordForEmail: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(SupabaseAuthService)
      .useValue(mockSupabaseAuthService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: currentUserContext.id,
            userId: currentUserContext.userId,
            userType: currentUserContext.userType,
            institutionalPerson: {
              id: currentUserContext.id,
              userType: currentUserContext.userType,
              status: currentUserContext.status,
            },
            memberships: currentUserContext.memberships || [],
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

  describe('1. Vertical Privilege Escalation Protection', () => {
    it('should reject STUDENT attempting to create organizations (403 Forbidden)', async () => {
      currentUserContext = {
        id: 'actor-student-1',
        userId: 'user-student-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      };

      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({ name: 'Malicious Org', code: 'MALICIOUS' })
        .expect(403);
    });

    it('should reject STUDENT attempting to list administrative user directory (403 Forbidden)', async () => {
      currentUserContext = {
        id: 'actor-student-1',
        userId: 'user-student-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      };

      await request(app.getHttpServer()).get('/api/v1/users').expect(403);
    });
  });

  describe('2. Account Suspension Protection', () => {
    it('should reject requests from SUSPENDED accounts via RolesGuard', async () => {
      currentUserContext = {
        id: 'actor-suspended-1',
        userId: 'user-suspended-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.SUSPENDED,
      };

      const res = await request(app.getHttpServer())
        .get('/api/v1/students/me/dashboard')
        .expect(403);

      expect(res.body.message).toContain('Account is inactive or suspended');
    });
  });

  describe('3. Anti-User Enumeration Resistance', () => {
    it('should return constant response message for non-existent email recovery', async () => {
      mockSupabaseAuthService.resetPasswordForEmail.mockResolvedValue(
        undefined,
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/recover-password')
        .send({ email: 'attacker_target@colegiosurcos.edu.ec' })
        .expect(200);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('4. Idempotency Key Caching & Replay Safety', () => {
    it('should return cached response when matching Idempotency-Key is provided', async () => {
      currentUserContext = {
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce({
        id: 'key-1',
        key: 'idemp-tx-12345',
        actorId: 'actor-admin-1',
        endpoint: 'POST /api/v1/organizations',
        responseData: {
          id: 'org-cached-1',
          name: 'AgroRed Central',
          code: 'AGRORED',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Idempotency-Key', 'idemp-tx-12345')
        .send({ name: 'AgroRed Central', code: 'AGRORED' })
        .expect(201);

      expect(res.body.id).toBe('org-cached-1');
      expect(mockPrismaService.organization.create).not.toHaveBeenCalled();
    });
  });
});
