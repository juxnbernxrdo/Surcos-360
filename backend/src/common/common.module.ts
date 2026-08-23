import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { IdempotencyService } from './services/idempotency.service';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { HealthController } from './controllers/health.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [IdempotencyService, IdempotencyInterceptor, AllExceptionsFilter],
  exports: [IdempotencyService, IdempotencyInterceptor, AllExceptionsFilter],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
