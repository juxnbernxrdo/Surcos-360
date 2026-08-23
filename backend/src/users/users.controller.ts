import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  UpdateUserStatusDto,
  QueryUsersDto,
  LinkIdentityDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserType } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Current user profile query.
   */
  @Get('me')
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  /**
   * Current user profile update.
   */
  @Patch('me')
  async updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * Admin directory query of all users.
   */
  @Get()
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  /**
   * Admin single user lookup by ID.
   */
  @Get(':id')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Admin updates user status (ACTIVE, SUSPENDED, INACTIVE).
   */
  @Patch(':id/status')
  @Roles(UserType.AUTHORITY)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.updateStatus(id, dto, actorId);
  }

  /**
   * Admin manually links institutional person to Supabase userId.
   */
  @Post('link-identity')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.OK)
  async linkIdentity(
    @Body() dto: LinkIdentityDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.linkIdentity(dto, actorId);
  }
}
