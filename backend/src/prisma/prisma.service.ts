import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Run queries inside a transaction with Postgres RLS JWT claims set.
   * This guarantees Capa 3 RLS enforcement per user.
   */
  async withRlsClaims<T>(jwtClaims: Record<string, any>, fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      const claimsJson = JSON.stringify(jwtClaims);
      await tx.$executeRawUnsafe(`SET LOCAL request.jwt.claims = '${claimsJson}'`);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
