import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from '../../auth/services/tokens.service';
import { InviteRepresentativeDto } from '../dto/student-representative.dto';
import { UserType, TokenType, TokenStatus } from '@prisma/client';

@Injectable()
export class StudentRepresentativeService {
  private readonly logger = new Logger(StudentRepresentativeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
  ) {}

  /**
   * Resolves Student InstitutionalPerson with profile and representative relations.
   */
  private async resolveStudent(identifier: string) {
    return this.prisma.institutionalPerson.findFirst({
      where: {
        OR: [{ id: identifier }, { userId: identifier }],
        userType: UserType.STUDENT,
      },
      include: {
        studentProfile: {
          include: {
            representative: {
              include: {
                institutionalPerson: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Retrieves the linked representative or active invitation for a student (§3.4 & §11-12 PRD v1.0).
   */
  async getStudentRepresentative(identifier: string) {
    const student = await this.resolveStudent(identifier);

    if (!student) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    const representativeProfile = student.studentProfile?.representative;

    if (representativeProfile) {
      const repPerson = representativeProfile.institutionalPerson;
      return {
        hasRepresentative: true,
        representative: {
          id: representativeProfile.id,
          personId: repPerson.id,
          firstName: repPerson.firstName,
          lastName: repPerson.lastName,
          email: repPerson.email,
          phoneNumber: representativeProfile.phoneNumber || 'N/A',
          identificationNumber:
            representativeProfile.identificationNumber || 'N/A',
          linkedAt: representativeProfile.createdAt,
        },
        pendingInvitation: null,
      };
    }

    // Check if there is an active pending invitation token created for this student
    const activeTokens = await this.prisma.registrationToken.findMany({
      where: {
        type: TokenType.REPRESENTATIVE,
        status: TokenStatus.ACTIVE,
        createdBy: student.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const pendingToken = activeTokens.length > 0 ? activeTokens[0] : null;

    return {
      hasRepresentative: false,
      representative: null,
      pendingInvitation: pendingToken
        ? {
            id: pendingToken.id,
            expiresAt: pendingToken.expiresAt,
            status: pendingToken.status,
            metadata: pendingToken.metadata,
          }
        : null,
    };
  }

  /**
   * Creates a single-use representative cryptographic invitation (§3.4 PRD v1.0).
   * Strict One-Representative rule enforcement:
   * 1. Rejects if student already has a representative linked.
   * 2. Revokes previous expired/active tokens to prevent dangling invitations.
   * 3. Generates 48-hour validity token with CSPRNG 256-bit entropy.
   * 4. Logs audit event REPRESENTATIVE_INVITED.
   */
  async createRepresentativeInvitation(
    identifier: string,
    dto: InviteRepresentativeDto,
    actorId?: string,
  ) {
    const student = await this.resolveStudent(identifier);

    if (!student) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    // 1. Strict One-Representative Constraint (§12 prompt, §3.4 PRD)
    if (student.studentProfile?.representativeId) {
      throw new ConflictException(
        'El estudiante ya cuenta con un representante legal vinculado. No es posible generar nuevas invitaciones.',
      );
    }

    // 2. Revoke any previous active tokens for this student to maintain single active link invariant
    await this.prisma.registrationToken.updateMany({
      where: {
        type: TokenType.REPRESENTATIVE,
        status: TokenStatus.ACTIVE,
        createdBy: student.id,
      },
      data: {
        status: TokenStatus.REVOKED,
      },
    });

    // 3. Generate cryptographic invitation token (48h validity)
    const { plaintextToken, tokenRecord } =
      await this.tokensService.createToken(
        {
          type: TokenType.REPRESENTATIVE,
          maxUses: 1,
          expiresInDays: 2, // 48 horas
          metadata: {
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`.trim(),
            institutionalCode: student.institutionalCode,
            course: student.studentProfile?.course,
            parentEmail: dto.parentEmail,
            parentName: dto.parentName,
          },
        },
        student.id,
      );

    // 4. Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || student.id,
          action: 'REPRESENTATIVE_INVITED',
          entity: 'StudentProfile',
          entityId: student.studentProfile?.id || student.id,
          newState: {
            studentId: student.id,
            tokenId: tokenRecord.id,
            parentEmail: dto.parentEmail || null,
            parentName: dto.parentName || null,
            expiresAt: tokenRecord.expiresAt,
          },
        },
      });
    } catch (auditErr) {
      this.logger.warn(
        `AuditLog failure on REPRESENTATIVE_INVITED: ${auditErr}`,
      );
    }

    return {
      token: plaintextToken,
      invitationUrl: `/auth/register-representative?token=${plaintextToken}`,
      expiresAt: tokenRecord.expiresAt,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      message:
        'Invitación criptográfica para representante legal generada exitosamente (vigencia: 48 horas).',
    };
  }

  /**
   * Unlinks representative from a student (§30 PRD / prompt).
   * Restricted to AUTHORITY or authorized supervisor.
   */
  async unlinkRepresentative(studentId: string, actorId: string) {
    const student = await this.prisma.institutionalPerson.findFirst({
      where: {
        OR: [{ id: studentId }, { userId: studentId }],
        userType: UserType.STUDENT,
      },
      include: {
        studentProfile: {
          include: { representative: true },
        },
      },
    });

    if (!student || !student.studentProfile) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    const previousRepId = student.studentProfile.representativeId;
    if (!previousRepId) {
      throw new BadRequestException(
        'El estudiante no tiene ningún representante legal vinculado actualmente.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { id: student.studentProfile!.id },
        data: { representativeId: null },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'REPRESENTATIVE_UNLINKED',
          entity: 'StudentProfile',
          entityId: student.studentProfile!.id,
          previousState: { representativeId: previousRepId },
          newState: { representativeId: null },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_UNLINKED',
          entity: 'RepresentativeProfile',
          entityId: previousRepId,
          previousState: { studentId: student.id },
          newState: { studentId: null },
        },
      });
    });

    return {
      success: true,
      message: 'Vínculo de representante legal revocado exitosamente.',
      studentId: student.id,
      unlinkedRepresentativeId: previousRepId,
    };
  }
}
