import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import {
  CreateLiabilityDto,
  UpdateLiabilityDto,
  QueryLiabilitiesDto,
} from '../dto/liability.dto';
import {
  Prisma,
  LiabilityStatus,
  TransactionType,
  EntryDirection,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class LiabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a new liability / obligation and posts double-entry transaction.
   */
  async createLiability(
    orgId: string,
    dto: CreateLiabilityDto,
    actorId: string,
  ) {
    const existing = await this.prisma.liability.findUnique({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un pasivo con el código '${dto.code}' en esta organización.`,
      );
    }

    const amountDecimal = new Decimal(dto.initialAmount);

    const liability = await this.prisma.$transaction(async (tx) => {
      const createdLiability = await tx.liability.create({
        data: {
          organizationId: orgId,
          code: dto.code.trim().toUpperCase(),
          type: dto.type,
          description: dto.description.trim(),
          supplierId: dto.supplierId || null,
          initialAmount: amountDecimal,
          outstandingBalance: amountDecimal,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: LiabilityStatus.PENDING,
        },
      });

      if (amountDecimal.greaterThan(0)) {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
        });
        const orgCode = org?.code || 'ORG';

        const accountsPayable = await this.ledgerService.getOrganizationAccount(
          orgId,
          `${orgCode}_ACCOUNTS_PAYABLE`,
          tx,
        );
        const operatingExpense =
          await this.ledgerService.getOrganizationAccount(
            orgId,
            `${orgCode}_OPERATING_EXPENSE`,
            tx,
          );

        await this.ledgerService.createTransaction(
          {
            type: TransactionType.EXPENSE,
            description: `Reconocimiento de Pasivo/Obligación: ${createdLiability.description} (${createdLiability.code})`,
            referenceType: 'LIABILITY',
            referenceId: createdLiability.id,
            organizationId: orgId,
            actorId,
            entries: [
              {
                ledgerAccountId: operatingExpense.id,
                direction: EntryDirection.DEBIT,
                amount: amountDecimal,
              },
              {
                ledgerAccountId: accountsPayable.id,
                direction: EntryDirection.CREDIT,
                amount: amountDecimal,
              },
            ],
          },
          tx,
        );
      }

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'CREATE_LIABILITY',
          entity: 'Liability',
          entityId: createdLiability.id,
          newState: {
            code: createdLiability.code,
            initialAmount: createdLiability.initialAmount.toString(),
          },
        },
      });

      return createdLiability;
    });

    return liability;
  }

  /**
   * Lists liabilities with filters and pagination.
   */
  async findAll(orgId: string, query: QueryLiabilitiesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LiabilityWhereInput = {
      organizationId: orgId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, liabilities] = await Promise.all([
      this.prisma.liability.count({ where }),
      this.prisma.liability.findMany({
        where,
        include: { supplier: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: liabilities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single liability by ID.
   */
  async findById(orgId: string, id: string) {
    const liability = await this.prisma.liability.findFirst({
      where: { id, organizationId: orgId },
      include: { supplier: true },
    });

    if (!liability) {
      throw new NotFoundException(`Pasivo con ID '${id}' no encontrado.`);
    }

    return liability;
  }

  /**
   * Updates liability status and outstanding balance.
   */
  async updateLiability(
    orgId: string,
    id: string,
    dto: UpdateLiabilityDto,
    actorId: string,
  ) {
    const liability = await this.findById(orgId, id);

    const updated = await this.prisma.liability.update({
      where: { id: liability.id },
      data: {
        description: dto.description ? dto.description.trim() : undefined,
        status: dto.status,
        outstandingBalance:
          dto.outstandingBalance !== undefined
            ? new Decimal(dto.outstandingBalance)
            : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: orgId,
        action: 'UPDATE_LIABILITY',
        entity: 'Liability',
        entityId: id,
        previousState: {
          status: liability.status,
          outstandingBalance: liability.outstandingBalance.toString(),
        },
        newState: {
          status: updated.status,
          outstandingBalance: updated.outstandingBalance.toString(),
        },
      },
    });

    return updated;
  }
}
