import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from '../services/idempotency.service';
import { Request } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string } }>();

    const method = req.method?.toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return next.handle();
    }

    const actorId = req.user?.id || 'anonymous';
    const endpoint = `${method} ${req.baseUrl || ''}${req.path || ''}`;

    const existingRecord = await this.idempotencyService.findKey(
      idempotencyKey,
      actorId,
      endpoint,
    );

    if (existingRecord) {
      return of(existingRecord.responseData);
    }

    return next.handle().pipe(
      tap((responseData) => {
        void this.idempotencyService
          .storeKey(idempotencyKey, actorId, endpoint, responseData)
          .catch(() => {
            // Ignore store error to not fail main response
          });
      }),
    );
  }
}
