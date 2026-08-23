/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupabaseAuthService } from '../src/auth/services/supabase-auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import {
  UserType,
  InstitutionStatus,
  TokenType,
  TokenStatus,
} from '@prisma/client';

describe('AuthController & TokensController (e2e Security & Compliance)', () => {
  let app: INestApplication;
  let currentUserContext: any = {
    id: 'actor-authority-1',
    userId: 'user-authority-1',
    userType: UserType.AUTHORITY,
    status: InstitutionStatus.ACTIVE,
  };

  const mockPrismaService = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    registrationToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    institutionalPerson: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    studentProfile: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    representativeProfile: {
      create: jest.fn(),
    },
    studentAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const mockSupabaseAuthService = {
    createUser: jest.fn(),
    signInWithPassword: jest.fn(),
    validateUserCredentials: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
    signOutAll: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUserPassword: jest.fn(),
    deleteUser: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Token Management Role Authorization', () => {
    it('should reject STUDENT attempting to create registration tokens (403 Forbidden)', async () => {
      currentUserContext = {
        id: 'actor-student-1',
        userId: 'user-student-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/tokens')
        .send({ type: TokenType.STUDENT, maxUses: 10 })
        .expect(403);
    });

    it('should allow AUTHORITY to create registration tokens (201 Created)', async () => {
      currentUserContext = {
        id: 'actor-authority-1',
        userId: 'user-authority-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockPrismaService.registrationToken.create.mockResolvedValueOnce({
        id: 'tok-new-1',
        type: TokenType.STUDENT,
        tokenHash: 'sha256hash',
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: futureDate,
        createdBy: 'actor-authority-1',
        metadata: {},
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/tokens')
        .send({ type: TokenType.STUDENT, maxUses: 1 })
        .expect(201);

      expect(res.body.data.id).toBe('tok-new-1');
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('2. Public Token Verification & Metadata Sanitization', () => {
    it('should return 400 Bad Request for an invalid registration token', async () => {
      mockPrismaService.registrationToken.findUnique.mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/tokens/verify')
        .send({ token: 'invalid_token_123' })
        .expect(400);

      expect(res.body.message).toContain(
        'Invalid or expired registration token',
      );
    });

    it('should return sanitized metadata and not leak private internal IDs', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockPrismaService.registrationToken.findUnique.mockResolvedValueOnce({
        id: 'tok-safe',
        type: TokenType.STUDENT,
        tokenHash: 'hash',
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: futureDate,
        metadata: {
          course: '3ro BGU',
          tutor: 'Prof. Gomez',
          institutionalPersonId: 'internal-secret-uuid',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/tokens/verify')
        .send({ token: 'st_tok_valid' })
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.type).toBe(TokenType.STUDENT);
      expect(res.body.metadata.course).toBe('3ro BGU');
      expect(res.body.metadata.institutionalPersonId).toBeUndefined();
    });
  });

  describe('3. Registration Payload Validation & Hardening', () => {
    it('should reject non-institutional domain with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@gmail.com',
          password: 'Password123!',
          firstName: 'Juan',
          lastName: 'Pérez',
        })
        .expect(400);
    });

    it('should reject non-whitelisted fields in DTO payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test_est@colegiosurcos.edu.ec',
          password: 'Password123!',
          firstName: 'Juan',
          lastName: 'Pérez',
          maliciousParam: 'injected',
        })
        .expect(400);
    });

    it('should reject passwords shorter than 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test_est@colegiosurcos.edu.ec',
          password: 'short',
          firstName: 'Juan',
          lastName: 'Pérez',
        })
        .expect(400);
    });
  });

  describe('4. Parent Invitation & Representative Registration Flow', () => {
    it('should allow student to generate invitation token', async () => {
      currentUserContext = {
        id: 'actor-student-1',
        userId: 'user-student-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      };

      mockPrismaService.institutionalPerson.findFirst.mockResolvedValueOnce({
        id: 'actor-student-1',
        userType: UserType.STUDENT,
        firstName: 'Juan',
        lastName: 'Pérez',
        studentProfile: { course: '3ro BGU "A"' },
      });

      mockPrismaService.registrationToken.create.mockResolvedValueOnce({
        id: 'tok-rep-invite-1',
        type: TokenType.REPRESENTATIVE,
        tokenHash: 'hash-rep',
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        metadata: { studentId: 'actor-student-1' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/invite-parent')
        .send({ parentEmail: 'padre@gmail.com' })
        .expect(201);

      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.invitationUrl).toContain('/auth/register-representative?token=');
    });

    it('should register representative and link to student', async () => {
      const repToken = {
        id: 'tok-rep-1',
        type: TokenType.REPRESENTATIVE,
        tokenHash: 'hash',
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(Date.now() + 100000),
        metadata: { studentId: 'student-target-1' },
      };

      mockPrismaService.registrationToken.findUnique.mockResolvedValue(repToken);

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'student-target-1',
        userType: UserType.STUDENT,
        studentProfile: { id: 'prof-st-1' },
      });

      mockSupabaseAuthService.createUser.mockResolvedValueOnce({
        id: 'sup-rep-user-1',
        email: 'parent@gmail.com',
      });

      mockPrismaService.institutionalPerson.create.mockResolvedValueOnce({
        id: 'rep-person-1',
        userId: 'sup-rep-user-1',
        userType: UserType.REPRESENTATIVE,
        email: 'parent@gmail.com',
        firstName: 'Elena',
        lastName: 'Rios',
      });

      mockPrismaService.representativeProfile.create.mockResolvedValueOnce({
        id: 'rep-prof-1',
        institutionalPersonId: 'rep-person-1',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register-representative')
        .send({
          token: 'valid_rep_token',
          email: 'parent@gmail.com',
          password: 'Password123!',
          firstName: 'Elena',
          lastName: 'Rios',
          phoneNumber: '0991122334',
        })
        .expect(201);

      expect(res.body.data.user.representedStudentId).toBe('student-target-1');
    });
  });

  describe('5. Session Refresh & Reauthentication', () => {
    it('should exchange a valid refresh token for new access tokens (200 OK)', async () => {
      mockSupabaseAuthService.refreshSession.mockResolvedValueOnce({
        accessToken: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        userId: 'user-refreshed-1',
      });

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'person-refreshed-1',
        userId: 'user-refreshed-1',
        email: 'active_est@colegiosurcos.edu.ec',
        firstName: 'Active',
        lastName: 'User',
        institutionalCode: 'EST-100',
        status: InstitutionStatus.ACTIVE,
        memberships: [],
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(res.body.data.accessToken).toBe('new-jwt-token');
      expect(res.body.data.user.id).toBe('person-refreshed-1');
    });

    it('should reauthenticate user for sensitive operations', async () => {
      currentUserContext = {
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        email: 'admin@colegiosurcos.edu.ec',
      });

      mockSupabaseAuthService.validateUserCredentials.mockResolvedValueOnce(true);

      mockPrismaService.registrationToken.create.mockResolvedValueOnce({
        id: 'tok-reauth-1',
        tokenHash: 'hash-reauth',
        status: TokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 600000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reauthenticate')
        .send({ password: 'AdminPassword123!' })
        .expect(200);

      expect(res.body.data.reauthenticated).toBe(true);
      expect(res.body.data.reauthToken).toBeDefined();
    });
  });

  describe('6. Password Change & Global Logout', () => {
    it('should change password successfully when current password matches', async () => {
      currentUserContext = {
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      };

      mockPrismaService.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        email: 'admin@colegiosurcos.edu.ec',
      });

      mockSupabaseAuthService.validateUserCredentials.mockResolvedValueOnce(true);
      mockSupabaseAuthService.updateUserPassword.mockResolvedValueOnce(undefined);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewSecurePassword456!',
        })
        .expect(200);

      expect(res.body.message).toContain('Contraseña cambiada exitosamente');
    });

    it('should revoke all sessions on logout-all', async () => {
      currentUserContext = {
        id: 'actor-admin-1',
        userId: 'user-admin-1',
        userType: UserType.AUTHORITY,
        status: InstitutionStatus.ACTIVE,
      };

      mockSupabaseAuthService.signOutAll.mockResolvedValueOnce(undefined);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .expect(200);

      expect(res.body.message).toContain('Todas las sesiones activas han sido cerradas');
    });
  });
});
