import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { OrganizationInvitationsService } from './services/organization-invitations.service';
import { MembershipsService } from '../memberships/services/memberships.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
  QueryOrganizationsDto,
  CreateOrganizationInvitationDto,
  TransferAdminDto,
  AddDirectMemberDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgPermissionsGuard } from '../auth/guards/org-permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  OrgRoles,
  RequirePermissions,
} from '../auth/decorators/org-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserType, OrganizationRole, MembershipStatus } from '@prisma/client';
import { OrgPermission } from './constants/permissions.constant';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly orgsService: OrganizationsService,
    private readonly invitationsService: OrganizationInvitationsService,
    private readonly membershipsService: MembershipsService,
  ) {}

  /**
   * Creates a new organization / PYME (§4 PRD v1.0).
   * Restricted to Platform Authorities.
   */
  @Post()
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.orgsService.createOrganization(dto, actorId);
  }

  /**
   * Lists all organizations with filters, search, and pagination.
   */
  @Get()
  async findAll(@Query() query: QueryOrganizationsDto) {
    return this.orgsService.findAll(query);
  }

  /**
   * Retrieves all organizations where the current authenticated user has active memberships.
   */
  @Get('my-organizations')
  async findMyOrganizations(@CurrentUser('id') actorId: string) {
    return this.orgsService.findUserOrganizations(actorId);
  }

  /**
   * Retrieves single organization details by ID or code.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orgsService.findById(id);
  }

  /**
   * Updates an organization's metadata or configuration (§4 PRD v1.0).
   */
  @Patch(':id')
  @RequirePermissions(OrgPermission.ORGANIZATION_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.orgsService.updateOrganization(id, dto, actorId);
  }

  /**
   * Updates organization status (ACTIVE, INACTIVE, SUSPENDED).
   * Restricted to Platform Authorities.
   */
  @Patch(':id/status')
  @Roles(UserType.AUTHORITY)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.orgsService.updateOrganizationStatus(id, dto, actorId);
  }

  /**
   * Atomically transfers the single ADMIN role of the organization to another active member (§4.2, §19 PRD v1.0).
   */
  @Post(':id/transfer-admin')
  @OrgRoles(OrganizationRole.ADMIN)
  async transferAdmin(
    @Param('id') id: string,
    @Body() dto: TransferAdminDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.orgsService.transferAdmin(id, dto, actorId);
  }

  /**
   * Lists all members of an organization with status/role filters (§8 PRD v1.0).
   */
  @Get(':id/members')
  @RequirePermissions(OrgPermission.MEMBERS_READ)
  async getMembers(
    @Param('id') id: string,
    @Query('role') role?: OrganizationRole,
    @Query('status') status?: MembershipStatus,
  ) {
    return this.orgsService.getMembers(id, role, status);
  }

  /**
   * Directly adds an existing institutional person as an organization member (§6, §8 PRD v1.0).
   */
  @Post(':id/members')
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async addDirectMember(
    @Param('id') organizationId: string,
    @Body() dto: AddDirectMemberDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.addDirectMember(
      organizationId,
      dto,
      actorId,
    );
  }

  /**
   * Creates a cryptographically secure, one-time invitation token for joining the organization (§9 PRD v1.0).
   */
  @Post(':id/invitations')
  @RequirePermissions(OrgPermission.MEMBERS_INVITE)
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @Param('id') organizationId: string,
    @Body() dto: CreateOrganizationInvitationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.invitationsService.createInvitation(
      organizationId,
      dto,
      actorId,
    );
  }

  /**
   * Lists all active and past invitations for the organization (§9 PRD v1.0).
   */
  @Get(':id/invitations')
  @RequirePermissions(OrgPermission.MEMBERS_READ)
  async listInvitations(@Param('id') organizationId: string) {
    return this.invitationsService.listInvitations(organizationId);
  }

  /**
   * Revokes an active invitation token (§9 PRD v1.0).
   */
  @Delete(':id/invitations/:invitationId')
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  async revokeInvitation(
    @Param('id') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.invitationsService.revokeInvitation(
      organizationId,
      invitationId,
      actorId,
    );
  }
}
