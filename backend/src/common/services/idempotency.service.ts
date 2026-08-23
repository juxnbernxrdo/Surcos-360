import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashResponse(data: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data || ''))
      .digest('hex');
  }

  hashPayload(data: unknown): string {
    return this.hashResponse(data);
  }

  async findKey(key: string, actorId: string, endpoint: string) {
    return this.prisma.idempotencyKey.findUnique({
      where: {
        key_actorId_endpoint: {
          key,
          actorId,
          endpoint,
        },
      },
    });
  }

  async storeKey(
    key: string,
    actorId: string,
    endpoint: string,
    responseData: unknown,
  ) {
    const responseHash = this.hashResponse(responseData);

    return this.prisma.idempotencyKey.upsert({
      where: {
        key_actorId_endpoint: {
          key,
          actorId,
          endpoint,
        },
      },
      update: {
        responseHash,
        responseData: responseData || {},
      },
      create: {
        key,
        actorId,
        endpoint,
        responseHash,
        responseData: responseData || {},
      },
    });
  }
}
