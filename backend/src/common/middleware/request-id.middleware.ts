import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerId = req.headers['x-request-id'] as string;
    const requestId = headerId || crypto.randomUUID();

    req.headers['x-request-id'] = requestId;
    (req as unknown as { requestId: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
