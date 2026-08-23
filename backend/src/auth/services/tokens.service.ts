import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTokenDto } from '../dto/create-token.dto';
import {
  Prisma,
  RegistrationToken,
  TokenStatus,
  TokenType,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to compute SHA-256 hash of a plaintext token.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a CSPRNG-backed secure token string.
   */
  generateSecureTokenString(prefix = 'st_tok'): string {
    const randomHex = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${randomHex}`;
  }

  /**
   * Creates a new polymorphic Token (Registration, Invitation, Password Reset, Reauth).
   * Stores ONLY the SHA-256 hash in the database.
   * Returns the plaintext token to the caller (returned once upon creation).
   */
  async createToken(
    dto: CreateTokenDto,
    createdById: string,
  ): Promise<{ tokenRecord: RegistrationToken; plaintextToken: string }> {
    const plaintextToken = this.generateSecureTokenString('st_tok');
    const tokenHash = this.hashToken(plaintextToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));

    const tokenRecord = await this.prisma.registrationToken.create({
      data: {
        type: dto.type,
        tokenHash,
        status: TokenStatus.ACTIVE,
        maxUses: dto.maxUses || 1,
        usesCount: 0,
        expiresAt,
        createdBy: createdById,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: createdById,
        action: 'TOKEN_CREATED',
        entity: 'RegistrationToken',
        entityId: tokenRecord.id,
        newState: { type: dto.type, maxUses: dto.maxUses, expiresAt },
      },
    });

    return { tokenRecord, plaintextToken };
  }

  /**
   * Creates a dedicated short-lived token (e.g. for Password Reset or Reauth).
   */
  async createShortLivedToken(
    type: TokenType,
    createdById: string,
    expiresInMinutes = 30,
    metadata: Record<string, unknown> = {},
  ): Promise<{ tokenRecord: RegistrationToken; plaintextToken: string }> {
    const plaintextToken = this.generateSecureTokenString('sec_tok');
    const tokenHash = this.hashToken(plaintextToken);

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const tokenRecord = await this.prisma.registrationToken.create({
      data: {
        type,
        tokenHash,
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt,
        createdBy: createdById,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return { tokenRecord, plaintextToken };
  }

  /**
   * Verifies if a raw token string is active and valid.
   * Returns sanitized token data safe for public consumption.
   */
  async verifyToken(rawToken: string): Promise<{
    id: string;
    type: TokenType;
    status: TokenStatus;
    maxUses: number;
    usesCount: number;
    expiresAt: Date;
    metadata: Record<string, unknown>;
  }> {
    const tokenHash = this.hashToken(rawToken);
    const tokenRecord = await this.prisma.registrationToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired registration token');
    }

    if (tokenRecord.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException('Invalid or expired registration token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      await this.prisma.registrationToken.update({
        where: { id: tokenRecord.id },
        data: { status: TokenStatus.EXPIRED },
      });
      throw new BadRequestException('Invalid or expired registration token');
    }

    if (tokenRecord.usesCount >= tokenRecord.maxUses) {
      throw new BadRequestException(
        'Registration token has reached maximum usages',
      );
    }

    // Sanitize metadata to prevent leaking sensitive internal fields
    const rawMeta = (tokenRecord.metadata || {}) as Record<string, unknown>;
    const sanitizedMeta: Record<string, unknown> = {
      course: rawMeta.course,
      tutor: rawMeta.tutor,
      organizationName: rawMeta.organizationName,
      role: rawMeta.role,
      studentName: rawMeta.studentName,
      studentId: rawMeta.studentId,
    };

    return {
      id: tokenRecord.id,
      type: tokenRecord.type,
      status: tokenRecord.status,
      maxUses: tokenRecord.maxUses,
      usesCount: tokenRecord.usesCount,
      expiresAt: tokenRecord.expiresAt,
      metadata: sanitizedMeta,
    };
  }

  /**
   * Atomically increments token usage using raw SQL conditional update.
   * Supports transactional execution to ensure rollback safety if registration fails.
   */
  async consumeToken(
    rawToken: string,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<RegistrationToken> {
    const tokenHash = this.hashToken(rawToken);

    const affectedRows = await prismaClient.$executeRaw`
      UPDATE "RegistrationToken"
      SET "usesCount" = "usesCount" + 1,
          "status" = CASE WHEN "usesCount" + 1 >= "maxUses" THEN 'USED'::"TokenStatus" ELSE 'ACTIVE'::"TokenStatus" END
      WHERE "tokenHash" = ${tokenHash}
        AND "status" = 'ACTIVE'
        AND "expiresAt" > NOW()
        AND "usesCount" < "maxUses"
    `;

    if (affectedRows === 0) {
      throw new BadRequestException(
        'Invalid, expired or fully consumed registration token',
      );
    }

    const tokenRecord = await prismaClient.registrationToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Registration token record lost');
    }

    return tokenRecord;
  }

  /**
   * Revokes an active token.
   */
  async revokeToken(
    tokenId: string,
    actorId: string,
  ): Promise<RegistrationToken> {
    const tokenRecord = await this.prisma.registrationToken.findUnique({
      where: { id: tokenId },
    });

    if (!tokenRecord) {
      throw new NotFoundException('Token not found');
    }

    const updatedToken = await this.prisma.registrationToken.update({
      where: { id: tokenId },
      data: { status: TokenStatus.REVOKED },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'TOKEN_REVOKED',
        entity: 'RegistrationToken',
        entityId: tokenId,
        previousState: { status: tokenRecord.status },
        newState: { status: TokenStatus.REVOKED },
      },
    });

    return updatedToken;
  }

  /**
   * Lists all tokens created in the system (for admin review).
   */
  async listTokens(): Promise<RegistrationToken[]> {
    return this.prisma.registrationToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
