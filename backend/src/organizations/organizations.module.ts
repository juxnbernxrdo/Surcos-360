import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { OrganizationInvitationsService } from './services/organization-invitations.service';
import { OrganizationsController } from './organizations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MembershipsModule), LedgerModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationInvitationsService],
  exports: [OrganizationsService, OrganizationInvitationsService],
})
export class OrganizationsModule {}
