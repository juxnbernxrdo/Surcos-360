import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { RegisterRepresentativeDto } from '../dto/register-representative.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { InviteParentDto } from '../dto/invite-parent.dto';
import { UserType, TokenType, InstitutionStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly INSTITUTIONAL_DOMAIN = '@colegiosurcos.edu.ec';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  /**
   * Helper to generate unique institutional code if not provided.
   */
  private generateInstitutionalCode(userType: UserType): string {
    const prefix = userType === UserType.STUDENT ? 'EST' : 'SUR';
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${Date.now().toString().slice(-4)}-${rand}`;
  }

  /**
   * Helper to generate account number for student wallets.
   */
  private generateAccountNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ACC-STU-${timestamp}-${random}`;
  }

  /**
   * Institutional Registration (§3.3 PRD v1.0):
   * Mandatory domain: @colegiosurcos.edu.ec
   * Student identification: *_est@colegiosurcos.edu.ec
   */
  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Mandatory Institutional Domain Check
    if (!normalizedEmail.endsWith(this.INSTITUTIONAL_DOMAIN)) {
      throw new BadRequestException(
        `INVALID_INSTITUTIONAL_DOMAIN: Solo se permite registro institucional con dominio '${this.INSTITUTIONAL_DOMAIN}'`,
      );
    }

    // 2. Deterministic Student / Staff detection
    const isStudent = /^[a-zA-Z0-9._%+-]+_est@colegiosurcos\.edu\.ec$/i.test(
      normalizedEmail,
    );
    const userType = isStudent ? UserType.STUDENT : UserType.TEACHER;

    const institutionalCode =
      dto.institutionalCode?.trim().toUpperCase() ||
      this.generateInstitutionalCode(userType);

    // 3. Pre-validate uniqueness in Prisma
    const [existingByEmail, existingByCode] = await Promise.all([
      this.prisma.institutionalPerson.findUnique({
        where: { email: normalizedEmail },
      }),
      this.prisma.institutionalPerson.findUnique({
        where: { institutionalCode },
      }),
    ]);

    if (existingByEmail && existingByEmail.userId) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con este correo electrónico.',
      );
    }

    if (
      existingByCode &&
      existingByCode.userId &&
      existingByCode.email !== normalizedEmail
    ) {
      throw new ConflictException(
        'El código institucional ya se encuentra vinculado a otra cuenta.',
      );
    }

    // 4. If token is provided, verify it
    if (dto.token) {
      await this.tokensService.verifyToken(dto.token);
    }

    // 5. Create Supabase Auth User
    const supabaseUser = await this.supabaseAuth.createUser(
      normalizedEmail,
      dto.password,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // If token provided, consume atomically
        if (dto.token) {
          await this.tokensService.consumeToken(dto.token, tx);
        }

        let person = existingByEmail || existingByCode;

        if (person) {
          person = await tx.institutionalPerson.update({
            where: { id: person.id },
            data: {
              userId: supabaseUser.id,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              userType,
              status: InstitutionStatus.ACTIVE,
            },
          });
        } else {
          person = await tx.institutionalPerson.create({
            data: {
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              email: normalizedEmail,
              institutionalCode,
              userType,
              userId: supabaseUser.id,
              status: InstitutionStatus.ACTIVE,
            },
          });
        }

        // Create specialized profile
        if (userType === UserType.STUDENT) {
          await tx.studentProfile.upsert({
            where: { institutionalPersonId: person.id },
            update: {
              course: dto.course?.trim() || '3ro BGU "A"',
              tutor: dto.tutor?.trim() || null,
            },
            create: {
              institutionalPersonId: person.id,
              course: dto.course?.trim() || '3ro BGU "A"',
              tutor: dto.tutor?.trim() || null,
            },
          });

          // Ensure StudentAccount exists in Surcos Saving
          const existingAccount = await tx.studentAccount.findUnique({
            where: { institutionalPersonId: person.id },
          });

          if (!existingAccount) {
            await tx.studentAccount.create({
              data: {
                institutionalPersonId: person.id,
                accountNumber: this.generateAccountNumber(),
              },
            });
          }

          // Create default customer profile
          const existingCust = await tx.customer.findFirst({
            where: { institutionalPersonId: person.id },
          });
          if (!existingCust) {
            await tx.customer.create({
              data: {
                institutionalPersonId: person.id,
                name: `${person.firstName} ${person.lastName}`.trim(),
                email: person.email,
                taxId: person.institutionalCode,
                customerType: 'STUDENT',
              },
            });
          }
        } else if (userType === UserType.TEACHER) {
          await tx.teacherProfile.upsert({
            where: { institutionalPersonId: person.id },
            update: {},
            create: {
              institutionalPersonId: person.id,
              department: 'General',
            },
          });
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorId: person.id,
            action: 'USER_REGISTERED',
            entity: 'InstitutionalPerson',
            entityId: person.id,
            newState: {
              userId: supabaseUser.id,
              email: person.email,
              userType: person.userType,
            },
            ipAddress,
            userAgent,
          },
        });

        return {
          id: person.id,
          userId: person.userId,
          userType: person.userType,
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          institutionalCode: person.institutionalCode,
          status: person.status,
        };
      });
    } catch (error) {
      await this.supabaseAuth.deleteUser(supabaseUser.id);
      throw error;
    }
  }

  /**
   * Representative / Parent Registration (§3.4 PRD v1.0):
   * Registers a parent via single-use invitation token without domain restrictions.
   */
  async registerRepresentative(
    dto: RegisterRepresentativeDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Verify invitation token
    const tokenRecord = await this.tokensService.verifyToken(dto.token);

    if (tokenRecord.type !== TokenType.REPRESENTATIVE) {
      throw new BadRequestException(
        'El token provisto no es válido para registro de representantes.',
      );
    }

    const metadata = tokenRecord.metadata || {};
    const studentId = metadata.studentId as string;

    if (!studentId) {
      throw new BadRequestException(
        'El token de invitación no contiene el identificador del estudiante.',
      );
    }

    // 2. Validate Student exists
    const student = await this.prisma.institutionalPerson.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    });

    if (!student || student.userType !== UserType.STUDENT) {
      throw new NotFoundException(
        'Estudiante vinculado al token no encontrado.',
      );
    }

    if (student.studentProfile?.representativeId) {
      throw new ConflictException(
        'El estudiante ya cuenta con un representante legal registrado.',
      );
    }

    // 3. Create Supabase Auth user
    const supabaseUser = await this.supabaseAuth.createUser(
      normalizedEmail,
      dto.password,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // A. Consume token atomically
        await this.tokensService.consumeToken(dto.token, tx);

        // B. Create InstitutionalPerson (REPRESENTATIVE)
        const representativeCode = this.generateInstitutionalCode(
          UserType.REPRESENTATIVE,
        );
        const person = await tx.institutionalPerson.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: normalizedEmail,
            institutionalCode: representativeCode,
            userType: UserType.REPRESENTATIVE,
            userId: supabaseUser.id,
            status: InstitutionStatus.ACTIVE,
          },
        });

        // C. Create RepresentativeProfile
        const repProfile = await tx.representativeProfile.create({
          data: {
            institutionalPersonId: person.id,
            phoneNumber: dto.phoneNumber?.trim() || null,
            identificationNumber: dto.identificationNumber?.trim() || null,
          },
        });

        // D. Link Student to this Representative
        if (student.studentProfile) {
          await tx.studentProfile.update({
            where: { id: student.studentProfile.id },
            data: { representativeId: repProfile.id },
          });
        }

        // E. Audit Log
        await tx.auditLog.create({
          data: {
            actorId: person.id,
            action: 'REPRESENTATIVE_REGISTERED',
            entity: 'RepresentativeProfile',
            entityId: repProfile.id,
            newState: {
              studentId,
              representativeEmail: normalizedEmail,
            },
            ipAddress,
            userAgent,
          },
        });

        return {
          id: person.id,
          userId: person.userId,
          userType: person.userType,
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          representedStudentId: studentId,
        };
      });
    } catch (error) {
      await this.supabaseAuth.deleteUser(supabaseUser.id);
      throw error;
    }
  }

  /**
   * Generates a parent invitation link (§3.4 PRD v1.0).
   * Created by student, single use, 48 hours validity.
   */
  async generateParentInvitation(
    studentIdentifier: string,
    dto?: InviteParentDto,
  ) {
    const student = await this.prisma.institutionalPerson.findFirst({
      where: {
        OR: [{ id: studentIdentifier }, { userId: studentIdentifier }],
        userType: UserType.STUDENT,
      },
      include: { studentProfile: true },
    });

    if (!student) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    if (student.studentProfile?.representativeId) {
      throw new ConflictException(
        'El estudiante ya cuenta con un representante legal registrado.',
      );
    }

    const { plaintextToken, tokenRecord } =
      await this.tokensService.createToken(
        {
          type: TokenType.REPRESENTATIVE,
          maxUses: 1,
          expiresInDays: 2, // 48 horas
          metadata: {
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`.trim(),
            course: student.studentProfile?.course,
            parentEmail: dto?.parentEmail,
            parentName: dto?.parentName,
          },
        },
        student.id,
      );

    return {
      token: plaintextToken,
      invitationUrl: `/auth/register-representative?token=${plaintextToken}`,
      expiresAt: tokenRecord.expiresAt,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
    };
  }

  /**
   * Authenticates user against Supabase Auth & attaches profile with memberships.
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    let authResult: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      userId: string;
    };

    try {
      authResult = await this.supabaseAuth.signInWithPassword(
        normalizedEmail,
        dto.password,
      );
    } catch (error) {
      // Log login failure
      await this.prisma.auditLog.create({
        data: {
          actorId: 'anonymous',
          action: 'LOGIN_FAILED',
          entity: 'AuthSession',
          entityId: normalizedEmail,
          previousState: { attemptedEmail: normalizedEmail },
          ipAddress,
          userAgent,
        },
      });
      throw error;
    }

    const person = await this.prisma.institutionalPerson.findUnique({
      where: { userId: authResult.userId },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: {
          include: { students: true },
        },
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!person) {
      throw new NotFoundException(
        'Perfil institucional no encontrado para este usuario.',
      );
    }

    if (person.status !== InstitutionStatus.ACTIVE) {
      throw new ForbiddenException(
        'La cuenta se encuentra inactiva o suspendida.',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: person.id,
        action: 'USER_LOGIN',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresIn: authResult.expiresIn,
      user: {
        id: person.id,
        userId: person.userId,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        userType: person.userType,
        institutionalCode: person.institutionalCode,
        status: person.status,
        studentProfile: person.studentProfile,
        teacherProfile: person.teacherProfile,
        authorityProfile: person.authorityProfile,
        representativeProfile: person.representativeProfile,
        memberships: person.memberships,
      },
    };
  }

  /**
   * Refreshes active JWT session using a valid refresh token.
   */
  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const authResult = await this.supabaseAuth.refreshSession(refreshToken);

    const person = await this.prisma.institutionalPerson.findUnique({
      where: { userId: authResult.userId },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: true,
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!person || person.status !== InstitutionStatus.ACTIVE) {
      throw new ForbiddenException(
        'La cuenta se encuentra inactiva o suspendida.',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: person.id,
        action: 'TOKEN_REFRESH',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresIn: authResult.expiresIn,
      user: {
        id: person.id,
        userId: person.userId,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        userType: person.userType,
        institutionalCode: person.institutionalCode,
        status: person.status,
        studentProfile: person.studentProfile,
        memberships: person.memberships,
      },
    };
  }

  /**
   * Fetches current authenticated user profile.
   */
  async getProfile(userId: string) {
    const person = await this.prisma.institutionalPerson.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: {
          include: { students: true },
        },
        customers: true,
        suppliers: true,
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!person) {
      throw new NotFoundException('Perfil de usuario no encontrado.');
    }

    return person;
  }

  /**
   * Signs out active session.
   */
  async logout(
    jwtToken: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.supabaseAuth.signOut(jwtToken);

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'USER_LOGOUT',
          entity: 'InstitutionalPerson',
          entityId: actorId,
          ipAddress,
          userAgent,
        },
      });
    }

    return { message: 'Cierre de sesión exitoso.' };
  }

  /**
   * Signs out all active sessions for user across all devices.
   */
  async logoutAll(
    userId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.supabaseAuth.signOutAll(userId);

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || userId,
        action: 'SESSIONS_REVOKED_ALL',
        entity: 'InstitutionalPerson',
        entityId: actorId || userId,
        ipAddress,
        userAgent,
      },
    });

    return { message: 'Todas las sesiones activas han sido cerradas.' };
  }

  /**
   * Initiates password recovery. Always returns generic message to prevent user enumeration.
   */
  async recoverPassword(email: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.supabaseAuth.resetPasswordForEmail(normalizedEmail);

    await this.prisma.auditLog.create({
      data: {
        actorId: 'anonymous',
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'InstitutionalPerson',
        entityId: normalizedEmail,
        ipAddress,
        userAgent,
      },
    });

    return {
      message:
        'Si existe una cuenta registrada con este correo, se han enviado las instrucciones de recuperación.',
    };
  }

  /**
   * Completes password reset using verified token.
   */
  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenRecord = await this.tokensService.verifyToken(dto.token);

    const metadata = tokenRecord.metadata || {};
    const userId = metadata.userId as string;

    if (!userId) {
      throw new BadRequestException(
        'El token de recuperación no contiene información de usuario válida.',
      );
    }

    // Consume token
    await this.tokensService.consumeToken(dto.token);

    // Update password in Supabase Auth
    await this.supabaseAuth.updateUserPassword(userId, dto.newPassword);

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'InstitutionalPerson',
        entityId: userId,
        ipAddress,
        userAgent,
      },
    });

    return {
      message: 'Contraseña actualizada exitosamente.',
    };
  }

  /**
   * Updates password for authenticated user with current password validation.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { userId },
    });

    if (!person) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Verify current password
    const isValid = await this.supabaseAuth.validateUserCredentials(
      person.email,
      dto.currentPassword,
    );

    if (!isValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    // Update password
    await this.supabaseAuth.updateUserPassword(userId, dto.newPassword);

    await this.prisma.auditLog.create({
      data: {
        actorId: person.id,
        action: 'PASSWORD_CHANGED',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      message: 'Contraseña cambiada exitosamente.',
    };
  }

  /**
   * Reauthenticates user for sensitive operations (§16 PRD v1.0).
   */
  async reauthenticate(
    userId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { userId },
    });

    if (!person) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const isValid = await this.supabaseAuth.validateUserCredentials(
      person.email,
      password,
    );

    if (!isValid) {
      await this.prisma.auditLog.create({
        data: {
          actorId: person.id,
          action: 'REAUTHENTICATION_FAILED',
          entity: 'InstitutionalPerson',
          entityId: person.id,
          ipAddress,
          userAgent,
        },
      });
      throw new UnauthorizedException(
        'Credenciales de reautenticación inválidas.',
      );
    }

    // Generate short-lived reauthentication token (valid 10 minutes)
    const { plaintextToken, tokenRecord } =
      await this.tokensService.createShortLivedToken(
        TokenType.REPRESENTATIVE, // Or polymorphic token
        person.id,
        10,
        { userId, reauthenticatedAt: new Date().toISOString() },
      );

    await this.prisma.auditLog.create({
      data: {
        actorId: person.id,
        action: 'REAUTHENTICATION_SUCCESS',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      reauthenticated: true,
      reauthToken: plaintextToken,
      expiresAt: tokenRecord.expiresAt,
    };
  }
}
