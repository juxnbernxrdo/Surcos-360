import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { TokensService } from '../../auth/services/tokens.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  UpdateStudentStatusDto,
  UpdateAcademicDto,
  LookupStudentDto,
} from '../dto/create-student.dto';
import { StudentQueryDto } from '../dto/student-query.dto';
import {
  UserType,
  TokenType,
  TransactionType,
  EntryDirection,
  InstitutionStatus,
  Prisma,
} from '@prisma/client';
import { StandardAccountCodes } from '../../ledger/constants/account-codes.constant';
import { MoneyUtil } from '../../common/money';

const Decimal = Prisma.Decimal;

export interface RequestActor {
  id: string;
  userType?: UserType;
  institutionId?: string | null;
}

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly tokensService: TokensService,
  ) {}

  /**
   * Verifica el alcance multi-tenant: un actor no-AUTHORITY solo puede operar
   * sobre estudiantes de su propia institución. AUTHORITY tiene alcance global.
   */
  private assertTenantAccess(
    actor: RequestActor | null | undefined,
    targetInstitutionId?: string | null,
  ): void {
    if (!actor) return;
    if (actor.userType === UserType.AUTHORITY) return;
    if (
      actor.institutionId &&
      targetInstitutionId &&
      actor.institutionId !== targetInstitutionId
    ) {
      throw new NotFoundException(
        'Estudiante no encontrado en la institución del usuario.',
      );
    }
  }

  /**
   * Generates a unique formatted account number for students.
   */
  private generateAccountNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ACC-STU-${timestamp}-${random}`;
  }

  /**
   * Helper to resolve InstitutionalPerson by userId or person id.
   */
  async resolveStudentPerson(identifier: string) {
    return this.prisma.institutionalPerson.findFirst({
      where: {
        OR: [{ userId: identifier }, { id: identifier }],
        userType: UserType.STUDENT,
      },
      include: {
        studentProfile: {
          include: {
            representative: {
              include: {
                institutionalPerson: true,
              },
            },
          },
        },
        studentAccount: true,
      },
    });
  }

  /**
   * Registers a single student atomically (§3.3 PRD v1.0):
   * 1. Validates identity uniqueness (email & institutionalCode)
   * 2. Creates InstitutionalPerson (STUDENT)
   * 3. Creates StudentProfile & Customer
   * 4. Creates StudentAccount in Surcos Saving
   * 5. Posts double-entry INITIAL_BALANCE transaction if initialBalance > 0
   * 6. Generates RegistrationToken for onboarding
   * 7. Writes AuditLog (STUDENT_CREATED)
   */
  async createStudent(dto: CreateStudentDto, actorId?: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedCode = dto.institutionalCode.trim().toUpperCase();
    const institutionId = dto.institutionId?.trim() || 'default-institution';

    // 1. Check existing email
    const existingEmail = await this.prisma.institutionalPerson.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException(
        `Ya existe una persona registrada con el correo '${dto.email}'.`,
      );
    }

    // 2. Check existing institutional code
    const existingCode = await this.prisma.institutionalPerson.findUnique({
      where: { institutionalCode: normalizedCode },
    });
    if (existingCode) {
      throw new ConflictException(
        `Ya existe una persona registrada con el código institucional '${dto.institutionalCode}'.`,
      );
    }

    const initialBalDecimal = new Decimal(dto.initialBalance || 0);
    if (initialBalDecimal.lessThan(0)) {
      throw new BadRequestException('El saldo inicial no puede ser negativo.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create InstitutionalPerson
        const person = await tx.institutionalPerson.create({
          data: {
            institutionId,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: normalizedEmail,
            institutionalCode: normalizedCode,
            userType: UserType.STUDENT,
            status: InstitutionStatus.ACTIVE,
          },
        });

        // 2. Create StudentProfile
        const studentProfile = await tx.studentProfile.create({
          data: {
            institutionalPersonId: person.id,
            course: dto.course.trim(),
            tutor: dto.tutor ? dto.tutor.trim() : null,
            academicYear: dto.academicYear
              ? dto.academicYear.trim()
              : '2026-2027',
          },
        });

        // 3. Create Customer profile for PYME purchases
        const customer = await tx.customer.create({
          data: {
            institutionalPersonId: person.id,
            name: `${person.firstName} ${person.lastName}`.trim(),
            email: person.email,
            taxId: person.institutionalCode,
            customerType: 'STUDENT',
          },
        });

        // 4. Create StudentAccount in Surcos Saving
        const studentAccount = await tx.studentAccount.create({
          data: {
            institutionalPersonId: person.id,
            accountNumber: this.generateAccountNumber(),
          },
        });

        // 5. Post double-entry transaction if initialBalance > 0
        if (initialBalDecimal.greaterThan(0)) {
          // Ensure Surcos Saving Central organization exists
          let savingOrg = await tx.organization.findUnique({
            where: { code: 'SAVING' },
          });

          if (!savingOrg) {
            savingOrg = await tx.organization.create({
              data: {
                code: 'SAVING',
                name: 'Surcos Saving Central',
                description: 'Organización Financiera Central de Surcos 360',
                isPyme: false,
              },
            });
          }

          // Resolve Surcos Saving Central Vault using LedgerService
          const centralVault = await this.ledgerService.getOrganizationAccount(
            savingOrg.id,
            StandardAccountCodes.SAVING_CENTRAL_VAULT,
            tx,
          );

          // Use LedgerService to create the initial balance transaction
          await this.ledgerService.createTransaction(
            {
              type: TransactionType.INITIAL_BALANCE,
              description: `Saldo inicial de ahorro para ${person.firstName} ${person.lastName} (${studentProfile.course})`,
              referenceType: 'STUDENT_ACCOUNT',
              referenceId: studentAccount.id,
              organizationId: savingOrg.id,
              actorId: actorId || person.id,
              entries: [
                {
                  ledgerAccountId: centralVault.id,
                  direction: EntryDirection.DEBIT,
                  amount: initialBalDecimal,
                },
                {
                  studentAccountId: studentAccount.id,
                  direction: EntryDirection.CREDIT,
                  amount: initialBalDecimal,
                },
              ],
            },
            tx,
          );
        }

        // 6. Generate RegistrationToken
        const { plaintextToken, tokenRecord } =
          await this.tokensService.createToken(
            {
              type: TokenType.STUDENT,
              maxUses: 1,
              expiresInDays: 30,
              metadata: {
                studentId: person.id,
                institutionalPersonId: person.id,
                email: person.email,
                institutionalCode: person.institutionalCode,
                course: studentProfile.course,
              },
            },
            actorId || person.id,
          );

        // 7. Record AuditLog
        await tx.auditLog.create({
          data: {
            actorId: actorId || person.id,
            action: 'STUDENT_CREATED',
            entity: 'InstitutionalPerson',
            entityId: person.id,
            newState: {
              email: person.email,
              institutionalCode: person.institutionalCode,
              course: studentProfile.course,
              initialBalance: initialBalDecimal.toString(),
              tokenId: tokenRecord.id,
            },
          },
        });

        return {
          student: person,
          studentProfile,
          customer,
          studentAccount,
          initialBalance: initialBalDecimal.toString(),
          registrationToken: plaintextToken,
        };
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException(
            'Conflicto de unicidad en los datos del estudiante (correo o código institucional).',
          );
        }
      }
      throw err;
    }
  }

  /**
   * Lists all students with pagination, sorting and filtering (Admin/Teacher view).
   */
  async findAll(query: StudentQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InstitutionalPersonWhereInput = {
      userType: UserType.STUDENT,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.institutionId) {
      where.institutionId = query.institutionId;
    }

    if (query.course) {
      where.studentProfile = {
        course: { contains: query.course, mode: 'insensitive' },
      };
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { institutionalCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    let orderBy: Prisma.InstitutionalPersonOrderByWithRelationInput = {
      createdAt: sortOrder,
    };

    if (sortField === 'lastName') {
      orderBy = { lastName: sortOrder };
    } else if (sortField === 'firstName') {
      orderBy = { firstName: sortOrder };
    }

    const [total, students] = await Promise.all([
      this.prisma.institutionalPerson.count({ where }),
      this.prisma.institutionalPerson.findMany({
        where,
        include: {
          studentProfile: {
            include: {
              representative: {
                include: {
                  institutionalPerson: true,
                },
              },
            },
          },
          studentAccount: true,
        },
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const accountIds = students
      .map((st) => st.studentAccount?.id)
      .filter((id): id is string => !!id);
    const balanceMap =
      await this.ledgerService.getStudentAccountBalances(accountIds);

    const enriched = students.map((st) => {
      const balance = st.studentAccount
        ? (balanceMap.get(st.studentAccount.id) ?? new Decimal(0))
        : new Decimal(0);

      const rep = st.studentProfile?.representative;
      const repName = rep
        ? `${rep.institutionalPerson.firstName} ${rep.institutionalPerson.lastName}`.trim()
        : null;

      return {
        id: st.id,
        firstName: st.firstName,
        lastName: st.lastName,
        email: st.email,
        institutionalCode: st.institutionalCode,
        institutionId: st.institutionId,
        course: st.studentProfile?.course || '',
        academicYear: st.studentProfile?.academicYear || '2026-2027',
        tutor: st.studentProfile?.tutor || '',
        accountNumber: st.studentAccount?.accountNumber || '',
        currentBalance: MoneyUtil.toString(balance),
        hasRepresentative: !!rep,
        representativeName: repName,
        status: st.status,
        hasAuthAccount: !!st.userId,
        createdAt: st.createdAt,
      };
    });

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single student by ID with full relations.
   */
  async findById(id: string, actor?: RequestActor | null) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
      include: {
        studentProfile: {
          include: {
            representative: {
              include: {
                institutionalPerson: true,
              },
            },
          },
        },
        studentAccount: true,
        customers: true,
      },
    });

    if (!person || person.userType !== UserType.STUDENT) {
      throw new NotFoundException(`Estudiante con ID '${id}' no encontrado.`);
    }

    this.assertTenantAccess(actor, person.institutionId);

    let currentBalance = new Decimal(0);
    if (person.studentAccount) {
      currentBalance = await this.ledgerService.getStudentAccountBalance(
        person.studentAccount.id,
      );
    }

    const rep = person.studentProfile?.representative;
    const representative = rep
      ? {
          id: rep.id,
          personId: rep.institutionalPerson.id,
          fullName:
            `${rep.institutionalPerson.firstName} ${rep.institutionalPerson.lastName}`.trim(),
          email: rep.institutionalPerson.email,
          phoneNumber: rep.phoneNumber || 'N/A',
          identificationNumber: rep.identificationNumber || 'N/A',
        }
      : null;

    return {
      id: person.id,
      institutionId: person.institutionId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      institutionalCode: person.institutionalCode,
      status: person.status,
      userId: person.userId,
      hasAuthAccount: !!person.userId,
      studentProfile: {
        course: person.studentProfile?.course || 'N/A',
        academicYear: person.studentProfile?.academicYear || '2026-2027',
        tutor: person.studentProfile?.tutor || 'Sin tutor asignado',
        representative,
      },
      customer: person.customers?.[0] || null,
      studentAccount: person.studentAccount,
      currentBalance: MoneyUtil.toString(currentBalance),
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  /**
   * Retrieves student's own institutional profile (§6.1 PRD v1.0).
   */
  async getStudentProfile(identifier: string) {
    const person = await this.resolveStudentPerson(identifier);

    if (!person) {
      throw new NotFoundException('Perfil de estudiante no encontrado.');
    }

    let currentBalance = new Decimal(0);
    if (person.studentAccount) {
      currentBalance = await this.ledgerService.getStudentAccountBalance(
        person.studentAccount.id,
      );
    }

    const rep = person.studentProfile?.representative;
    const representative = rep
      ? {
          id: rep.id,
          fullName:
            `${rep.institutionalPerson.firstName} ${rep.institutionalPerson.lastName}`.trim(),
          email: rep.institutionalPerson.email,
          phoneNumber: rep.phoneNumber || 'N/A',
          identificationNumber: rep.identificationNumber || 'N/A',
        }
      : null;

    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      institutionalCode: person.institutionalCode,
      institutionId: person.institutionId,
      status: person.status,
      course: person.studentProfile?.course || 'N/A',
      academicYear: person.studentProfile?.academicYear || '2026-2027',
      tutor: person.studentProfile?.tutor || 'Sin tutor asignado',
      representative,
      accountNumber: person.studentAccount?.accountNumber || 'N/A',
      currentBalance: MoneyUtil.toString(currentBalance),
      hasAuthAccount: !!person.userId,
      createdAt: person.createdAt,
    };
  }

  /**
   * Updates student personal and academic information safely (Supervisors only).
   */
  async updateStudent(
    id: string,
    dto: UpdateStudentDto,
    actorId: string,
    actor?: RequestActor | null,
  ) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
      include: { studentProfile: true },
    });

    if (!person || person.userType !== UserType.STUDENT) {
      throw new NotFoundException(`Estudiante con ID '${id}' no encontrado.`);
    }

    this.assertTenantAccess(actor, person.institutionId);

    const previousState = {
      firstName: person.firstName,
      lastName: person.lastName,
      course: person.studentProfile?.course,
      tutor: person.studentProfile?.tutor,
      academicYear: person.studentProfile?.academicYear,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.institutionalPerson.update({
        where: { id },
        data: {
          firstName: dto.firstName ? dto.firstName.trim() : undefined,
          lastName: dto.lastName ? dto.lastName.trim() : undefined,
        },
      });

      if (
        dto.course !== undefined ||
        dto.tutor !== undefined ||
        dto.academicYear !== undefined
      ) {
        await tx.studentProfile.upsert({
          where: { institutionalPersonId: id },
          update: {
            course: dto.course ? dto.course.trim() : undefined,
            tutor: dto.tutor ? dto.tutor.trim() : undefined,
            academicYear: dto.academicYear
              ? dto.academicYear.trim()
              : undefined,
          },
          create: {
            institutionalPersonId: id,
            course: dto.course ? dto.course.trim() : '3ro BGU "A"',
            tutor: dto.tutor ? dto.tutor.trim() : null,
            academicYear: dto.academicYear
              ? dto.academicYear.trim()
              : '2026-2027',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_UPDATED',
          entity: 'InstitutionalPerson',
          entityId: id,
          previousState: previousState,
          newState: dto as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.findById(id, actor);
  }

  /**
   * Dedicated academic update endpoint (Course, Tutor, Academic Year) (§10 PRD v1.0).
   */
  async updateAcademicData(
    id: string,
    dto: UpdateAcademicDto,
    actorId: string,
    actor?: RequestActor | null,
  ) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
      include: { studentProfile: true },
    });

    if (!person || person.userType !== UserType.STUDENT) {
      throw new NotFoundException(`Estudiante con ID '${id}' no encontrado.`);
    }

    this.assertTenantAccess(actor, person.institutionId);

    const previousAcademic = {
      course: person.studentProfile?.course,
      tutor: person.studentProfile?.tutor,
      academicYear: person.studentProfile?.academicYear,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.upsert({
        where: { institutionalPersonId: id },
        update: {
          course: dto.course.trim(),
          tutor: dto.tutor ? dto.tutor.trim() : undefined,
          academicYear: dto.academicYear ? dto.academicYear.trim() : undefined,
        },
        create: {
          institutionalPersonId: id,
          course: dto.course.trim(),
          tutor: dto.tutor ? dto.tutor.trim() : null,
          academicYear: dto.academicYear
            ? dto.academicYear.trim()
            : '2026-2027',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ACADEMIC_DATA_UPDATED',
          entity: 'StudentProfile',
          entityId: person.studentProfile?.id || id,
          previousState: previousAcademic,
          newState: dto as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.findById(id, actor);
  }

  /**
   * Updates student institution status.
   */
  async updateStatus(
    id: string,
    dto: UpdateStudentStatusDto,
    actorId: string,
    actor?: RequestActor | null,
  ) {
    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id },
    });

    if (!person || person.userType !== UserType.STUDENT) {
      throw new NotFoundException(`Estudiante con ID '${id}' no encontrado.`);
    }

    this.assertTenantAccess(actor, person.institutionId);

    const updated = await this.prisma.institutionalPerson.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'STUDENT_STATUS_UPDATED',
        entity: 'InstitutionalPerson',
        entityId: id,
        previousState: { status: person.status },
        newState: { status: dto.status, reason: dto.reason || null },
      },
    });

    return updated;
  }

  /**
   * Alias for controller compatibility.
   */
  async updateStudentStatus(
    id: string,
    dto: UpdateStudentStatusDto,
    actorId: string,
  ) {
    return this.updateStatus(id, dto, actorId);
  }

  /**
   * Cashier POS student lookup by code or email for commercial transactions.
   */
  async lookupStudent(query: LookupStudentDto) {
    if (!query.code && !query.email) {
      throw new BadRequestException(
        'Debe proporcionar el código institucional o el correo electrónico para la búsqueda.',
      );
    }

    const where: Prisma.InstitutionalPersonWhereInput = {
      userType: UserType.STUDENT,
      status: InstitutionStatus.ACTIVE,
    };

    if (query.code) {
      where.institutionalCode = query.code.trim().toUpperCase();
    } else if (query.email) {
      where.email = query.email.trim().toLowerCase();
    }

    const student = await this.prisma.institutionalPerson.findFirst({
      where,
      include: {
        studentProfile: true,
        studentAccount: true,
        customers: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Estudiante activo no encontrado.');
    }

    let currentBalance = new Decimal(0);
    if (student.studentAccount) {
      currentBalance = await this.ledgerService.getStudentAccountBalance(
        student.studentAccount.id,
      );
    }

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      email: student.email,
      institutionalCode: student.institutionalCode,
      course: student.studentProfile?.course || 'N/A',
      accountNumber: student.studentAccount?.accountNumber || 'N/A',
      currentBalance: MoneyUtil.toString(currentBalance),
      customerId: student.customers?.[0]?.id || null,
    };
  }
}
