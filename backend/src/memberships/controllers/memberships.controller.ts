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
import { MembershipsService } from '../services/memberships.service';
import { OrganizationInvitationsService } from '../../organizations/services/organization-invitations.service';
import {
  UpdateMembershipPermissionsDto,
  UpdateMembershipStatusDto,
  ClaimInvitationDto,
  RegisterWithInvitationDto,
  QueryMembershipsDto,
} from '../dto';
import { AddDirectMemberDto } from '../../organizations/dto/add-direct-member.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgPermissionsGuard } from '../../auth/guards/org-permissions.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/decorators/org-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserType } from '@prisma/client';
import { OrgPermission } from '../../organizations/constants/permissions.constant';

@Controller('memberships')
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  /**
   * Verifies an organization invitation token (Public endpoint) (§9 PRD v1.0).
   */
  @Post('invitations/verify')
  @HttpCode(HttpStatus.OK)
  async verifyInvitation(@Body() dto: ClaimInvitationDto) {
    return this.invitationsService.verifyInvitation(dto.token);
  }

  /**
   * Claims an invitation for an existing authenticated user (§10 PRD v1.0).
   */
  @Post('invitations/claim')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async claimInvitation(
    @Body() dto: ClaimInvitationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.claimInvitation(dto, actorId);
  }

  /**
   * Registers a new user and claims the invitation token atomically (§11 PRD v1.0).
   */
  @Post('invitations/register')
  @HttpCode(HttpStatus.CREATED)
  async registerWithInvitation(@Body() dto: RegisterWithInvitationDto) {
    return this.membershipsService.registerWithInvitation(dto);
  }

  /**
   * Lists all memberships across the platform (Authority only).
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHORITY)
  async findAll(@Query() query: QueryMembershipsDto) {
    return this.membershipsService.findAll(query);
  }

  /**
   * Retrieves all memberships of the currently authenticated user (§3.1, §12 PRD v1.0).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMyMemberships(@CurrentUser('id') actorId: string) {
    return this.membershipsService.findUserMemberships(actorId);
  }

  /**
   * Directly adds an existing user as a member to an organization (§6, §8 PRD v1.0).
   */
  @Post('direct')
  @UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async addDirect(
    @Query('organizationId') orgIdFromQuery: string,
    @Body() dto: AddDirectMemberDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.addDirectMember(
      orgIdFromQuery,
      dto,
      actorId,
    );
  }

  /**
   * Retrieves single membership details by ID.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.membershipsService.findById(id);
  }

  /**
   * Updates granular modular permissions of an existing member (§5.2 PRD v1.0).
   */
  @Patch(':id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipPermissionsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.updatePermissions(id, dto, actorId);
  }

  /**
   * Updates lifecycle status of a membership (ACTIVE, SUSPENDED, REVOKED) (§17 PRD v1.0).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.updateStatus(id, dto, actorId);
  }

  /**
   * Removes / revokes an organization membership (§18 PRD v1.0).
   * Note: The user account remains intact in Surcos 360.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
  @RequirePermissions(OrgPermission.MEMBERS_MANAGE)
  async removeMember(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.membershipsService.removeMember(id, actorId);
  }
}
