import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserDto,
  UpdateUserStatusDto,
  QueryUsersDto,
  LinkIdentityDto,
} from './dto/user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves full profile for the authenticated user by Supabase Auth userId or Person id.
   */
  async getProfile(userId: string) {
    const person = await this.prisma.institutionalPerson.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: {
          include: { students: true },
        },
        customers: true,
        suppliers: true,
        studentAccount: true,
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!person) {
      throw new NotFoundException('Perfil institucional no encontrado.');
    }

    return person;
  }

  /**
   * Updates profile fields for the authenticated user.
   */
  async updateProfile(userId: string, dto: UpdateUserDto) {
    const person = await this.prisma.institutionalPerson.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
    });

    if (!person) {
      throw new NotFoundException('Perfil de usuario no encontrado.');
    }

    return this.prisma.institutionalPerson.update({
      where: { id: person.id },
      data: {
        firstName: dto.firstName ? dto.firstName.trim() : undefined,
        lastName: dto.lastName ? dto.lastName.trim() : undefined,
      },
    });
  }

  /**
   * Lists all users with pagination, filters and search (Admin only).
   */
  async findAll(query: QueryUsersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InstitutionalPersonWhereInput = {};

    if (query.userType) {
      where.userType = query.userType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { institutionalCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.institutionalPerson.count({ where }),
      this.prisma.institutionalPerson.findMany({
        where,
        include: {
          studentProfile: true,
          teacherProfile: true,
          authorityProfile: true,
          representativeProfile: true,
          memberships: {
            include: { organization: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single user by ID.
   */
  async findById(id: string) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: {
          include: { students: true },
        },
        customers: true,
        suppliers: true,
        studentAccount: true,
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!person) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado.`);
    }

    return person;
  }

  /**
   * Updates user status (ACTIVE, INACTIVE, SUSPENDED) and creates audit log.
   */
  async updateStatus(id: string, dto: UpdateUserStatusDto, actorId: string) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
    });

    if (!person) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado.`);
    }

    const updated = await this.prisma.institutionalPerson.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE_USER_STATUS',
        entity: 'InstitutionalPerson',
        entityId: id,
        previousState: { status: person.status },
        newState: { status: dto.status },
      },
    });

    return updated;
  }

  /**
   * Manually links a pre-imported InstitutionalPerson to a Supabase userId (Admin only).
   */
  async linkIdentity(dto: LinkIdentityDto, actorId: string) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id: dto.institutionalPersonId },
    });

    if (!person) {
      throw new NotFoundException(
        `Persona institucional '${dto.institutionalPersonId}' no encontrada.`,
      );
    }

    if (person.userId) {
      throw new ConflictException(
        'Esta persona institucional ya se encuentra vinculada a una cuenta de usuario.',
      );
    }

    const existingUser = await this.prisma.institutionalPerson.findUnique({
      where: { userId: dto.userId },
    });

    if (existingUser) {
      throw new ConflictException(
        'El identificador de Supabase Auth ya está asignado a otra persona institucional.',
      );
    }

    const updated = await this.prisma.institutionalPerson.update({
      where: { id: dto.institutionalPersonId },
      data: { userId: dto.userId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'LINK_IDENTITY',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        newState: { userId: dto.userId },
      },
    });

    return updated;
  }
}
