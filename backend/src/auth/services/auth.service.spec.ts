/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  TokenType,
  TokenStatus,
  UserType,
  OrganizationRole,
  InstitutionStatus,
} from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: any;
  let tokensServiceMock: any;
  let supabaseAuthMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      registrationToken: {
        findUnique: jest.fn(),
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
      teacherProfile: {
        upsert: jest.fn(),
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
    };

    tokensServiceMock = {
      hashToken: jest.fn().mockReturnValue('hashed-token'),
      createToken: jest.fn(),
      createShortLivedToken: jest.fn(),
      verifyToken: jest.fn(),
      consumeToken: jest.fn(),
    };

    supabaseAuthMock = {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokensService, useValue: tokensServiceMock },
        { provide: SupabaseAuthService, useValue: supabaseAuthMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should reject non-institutional domain with BadRequestException', async () => {
      await expect(
        service.register({
          email: 'user@gmail.com',
          password: 'Password123!',
          firstName: 'Juan',
          lastName: 'Pérez',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should register institutional student and auto-create StudentProfile and StudentAccount', async () => {
      const studentEmail = 'juan.perez_est@colegiosurcos.edu.ec';

      prismaMock.institutionalPerson.findUnique.mockResolvedValue(null);
      supabaseAuthMock.createUser.mockResolvedValue({
        id: 'sub-student-1',
        email: studentEmail,
      });

      const newPerson = {
        id: 'person-student-1',
        email: studentEmail,
        institutionalCode: 'EST-001',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
        userId: 'sub-student-1',
        firstName: 'Juan',
        lastName: 'Pérez',
      };

      prismaMock.institutionalPerson.create.mockResolvedValue(newPerson);
      prismaMock.studentAccount.findUnique.mockResolvedValue(null);
      prismaMock.customer.findFirst.mockResolvedValue(null);

      const result = await service.register({
        email: studentEmail,
        password: 'Password123!',
        firstName: 'Juan',
        lastName: 'Pérez',
        course: '3ro BGU "A"',
      });

      expect(result.id).toBe('person-student-1');
      expect(result.userType).toBe(UserType.STUDENT);
      expect(prismaMock.studentProfile.upsert).toHaveBeenCalled();
      expect(prismaMock.studentAccount.create).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('should rollback Supabase user if database transaction fails', async () => {
      const studentEmail = 'ana.ruiz_est@colegiosurcos.edu.ec';
      prismaMock.institutionalPerson.findUnique.mockResolvedValue(null);
      supabaseAuthMock.createUser.mockResolvedValue({
        id: 'supabase-user-rollback',
        email: studentEmail,
      });
      prismaMock.$transaction.mockRejectedValue(
        new Error('Database unique constraint failed'),
      );

      await expect(
        service.register({
          email: studentEmail,
          password: 'Password123!',
          firstName: 'Ana',
          lastName: 'Ruiz',
        }),
      ).rejects.toThrow('Database unique constraint failed');

      expect(supabaseAuthMock.deleteUser).toHaveBeenCalledWith(
        'supabase-user-rollback',
      );
    });
  });

  describe('registerRepresentative', () => {
    it('should register a representative via invitation token with arbitrary email and link to student', async () => {
      const tokenRecord = {
        id: 'tok-rep-1',
        type: TokenType.REPRESENTATIVE,
        status: TokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 100000),
        usesCount: 0,
        maxUses: 1,
        metadata: { studentId: 'student-id-123' },
      };

      tokensServiceMock.verifyToken.mockResolvedValue(tokenRecord);
      tokensServiceMock.consumeToken.mockResolvedValue(tokenRecord);

      prismaMock.institutionalPerson.findUnique.mockResolvedValue({
        id: 'student-id-123',
        userType: UserType.STUDENT,
        studentProfile: { id: 'prof-stu-1' },
      });

      supabaseAuthMock.createUser.mockResolvedValue({
        id: 'supabase-rep-1',
        email: 'parent@gmail.com',
      });

      prismaMock.institutionalPerson.create.mockResolvedValue({
        id: 'rep-person-1',
        userId: 'supabase-rep-1',
        userType: UserType.REPRESENTATIVE,
        email: 'parent@gmail.com',
        firstName: 'Carlos',
        lastName: 'Pérez',
      });

      prismaMock.representativeProfile.create.mockResolvedValue({
        id: 'rep-prof-1',
        institutionalPersonId: 'rep-person-1',
      });

      const res = await service.registerRepresentative({
        token: 'token-rep-abc',
        email: 'parent@gmail.com',
        password: 'Password123!',
        firstName: 'Carlos',
        lastName: 'Pérez',
        phoneNumber: '0991234567',
      });

      expect(res.userType).toBe(UserType.REPRESENTATIVE);
      expect(res.representedStudentId).toBe('student-id-123');
      expect(tokensServiceMock.consumeToken).toHaveBeenCalledWith(
        'token-rep-abc',
        prismaMock,
      );
      expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'prof-stu-1' },
        data: { representativeId: 'rep-prof-1' },
      });
    });
  });

  describe('generateParentInvitation', () => {
    it('should create single-use 48h token for student', async () => {
      prismaMock.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-id-1',
        userType: UserType.STUDENT,
        firstName: 'Juan',
        lastName: 'Pérez',
        studentProfile: { course: '3ro BGU' },
      });

      tokensServiceMock.createToken.mockResolvedValue({
        plaintextToken: 'tok_parent_invitation_123',
        tokenRecord: {
          id: 'tok-rec-1',
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      });

      const res = await service.generateParentInvitation('student-id-1');
      expect(res.token).toBe('tok_parent_invitation_123');
      expect(res.invitationUrl).toContain('/auth/register-representative?token=');
      expect(tokensServiceMock.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TokenType.REPRESENTATIVE,
          maxUses: 1,
          expiresInDays: 2,
        }),
        'student-id-1',
      );
    });
  });

  describe('login', () => {
    it('should return session tokens and user profile on successful login', async () => {
      supabaseAuthMock.signInWithPassword.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
        expiresIn: 900,
        userId: 'sub-user-123',
      });

      const person = {
        id: 'person-1',
        userId: 'sub-user-123',
        email: 'juan_est@colegiosurcos.edu.ec',
        firstName: 'Juan',
        lastName: 'Pérez',
        institutionalCode: 'EST-001',
        status: InstitutionStatus.ACTIVE,
        memberships: [],
      };

      prismaMock.institutionalPerson.findUnique.mockResolvedValue(person);

      const result = await service.login({
        email: 'juan_est@colegiosurcos.edu.ec',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('access-jwt');
      expect(result.user.id).toBe('person-1');
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('should reject login for suspended account with ForbiddenException', async () => {
      supabaseAuthMock.signInWithPassword.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
        expiresIn: 900,
        userId: 'sub-user-suspended',
      });

      const suspendedPerson = {
        id: 'person-suspended',
        userId: 'sub-user-suspended',
        email: 'suspended_est@colegiosurcos.edu.ec',
        status: InstitutionStatus.SUSPENDED,
      };

      prismaMock.institutionalPerson.findUnique.mockResolvedValue(
        suspendedPerson,
      );

      await expect(
        service.login({
          email: 'suspended_est@colegiosurcos.edu.ec',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh session tokens successfully for active accounts', async () => {
      supabaseAuthMock.refreshSession.mockResolvedValue({
        accessToken: 'new-access-jwt',
        refreshToken: 'new-refresh-jwt',
        expiresIn: 900,
        userId: 'user-refresh-1',
      });

      const person = {
        id: 'person-refresh-1',
        userId: 'user-refresh-1',
        email: 'active_est@colegiosurcos.edu.ec',
        status: InstitutionStatus.ACTIVE,
        memberships: [],
      };

      prismaMock.institutionalPerson.findUnique.mockResolvedValue(person);

      const res = await service.refreshToken('valid-refresh-token');
      expect(res.accessToken).toBe('new-access-jwt');
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should validate current password and update to new password', async () => {
      prismaMock.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        email: 'test@colegiosurcos.edu.ec',
      });
      supabaseAuthMock.validateUserCredentials.mockResolvedValue(true);
      supabaseAuthMock.updateUserPassword.mockResolvedValue(undefined);

      const res = await service.changePassword('user-1', {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword123!',
      });

      expect(res.message).toContain('Contraseña cambiada exitosamente');
      expect(supabaseAuthMock.updateUserPassword).toHaveBeenCalledWith(
        'user-1',
        'NewPassword123!',
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      prismaMock.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        email: 'test@colegiosurcos.edu.ec',
      });
      supabaseAuthMock.validateUserCredentials.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('reauthenticate', () => {
    it('should verify password and return short-lived token', async () => {
      prismaMock.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        email: 'test@colegiosurcos.edu.ec',
      });
      supabaseAuthMock.validateUserCredentials.mockResolvedValue(true);
      tokensServiceMock.createShortLivedToken.mockResolvedValue({
        plaintextToken: 'sec_tok_reauth_123',
        tokenRecord: { expiresAt: new Date(Date.now() + 600000) },
      });

      const res = await service.reauthenticate('user-1', 'ValidPassword123!');

      expect(res.reauthenticated).toBe(true);
      expect(res.reauthToken).toBe('sec_tok_reauth_123');
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should invoke global signout and record audit log', async () => {
      supabaseAuthMock.signOutAll.mockResolvedValue(undefined);

      const res = await service.logoutAll('user-1', 'p-1');
      expect(res.message).toContain('Todas las sesiones activas han sido cerradas');
      expect(supabaseAuthMock.signOutAll).toHaveBeenCalledWith('user-1');
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });
});
