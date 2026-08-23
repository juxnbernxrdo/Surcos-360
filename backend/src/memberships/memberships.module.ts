import { Module, forwardRef } from '@nestjs/common';
import { MembershipsService } from './services/memberships.service';
import { MembershipsController } from './controllers/memberships.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrganizationsModule)],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
