import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import {
  CreateRentalDto,
  ReturnRentalDto,
  QueryRentalsDto,
} from '../dto/rental.dto';
import {
  Prisma,
  RentalStatus,
  TransactionType,
  EntryDirection,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a game/recreational rental for Surcasino (§9.3 PRD v1.0).
   */
  async createRental(orgId: string, dto: CreateRentalDto, actorId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: {
        institutionalPerson: {
          include: { studentAccount: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const duration = new Decimal(dto.durationHours || 1.0);
    const hourlyRate = new Decimal(dto.hourlyRate);
    const totalAmount = duration.mul(hourlyRate);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Rental Record
      const rental = await tx.rental.create({
        data: {
          organizationId: orgId,
          customerId: dto.customerId,
          assetId: dto.assetId || null,
          productId: dto.productId || null,
          itemName: dto.itemName.trim(),
          durationHours: duration,
          hourlyRate,
          totalAmount,
          status: RentalStatus.ACTIVE,
          registeredBy: actorId,
        },
      });

      // 2. If student and has balance, execute ledger transaction
      if (
        customer.institutionalPerson?.studentAccount &&
        totalAmount.greaterThan(0)
      ) {
        const studentAccount = customer.institutionalPerson.studentAccount;

        // Verificación de saldo bajo bloqueo de fila (evita doble gasto TOCTOU)
        await this.ledgerService.lockStudentAccount(studentAccount.id, tx);

        const balance = await this.ledgerService.getStudentAccountBalance(
          studentAccount.id,
          tx,
        );

        if (balance.lessThan(totalAmount)) {
          throw new BadRequestException(
            `Saldo insuficiente para alquilar (Requerido: $${totalAmount.toString()}, Disponible: $${balance.toString()}).`,
          );
        }

        const org = await tx.organization.findUnique({
          where: { id: orgId },
        });
        const orgCode = org?.code || 'CASINO';

        const casinoRevenue = await this.ledgerService.getOrganizationAccount(
          orgId,
          `${orgCode}_REVENUE`,
          tx,
        );

        await this.ledgerService.createTransaction(
          {
            type: TransactionType.RENTAL_FEE,
            description: `Alquiler recreativo en Surcasino: ${rental.itemName} (${rental.durationHours.toString()}h)`,
            referenceType: 'RENTAL',
            referenceId: rental.id,
            organizationId: orgId,
            actorId,
            entries: [
              {
                studentAccountId: studentAccount.id,
                direction: EntryDirection.DEBIT,
                amount: totalAmount,
              },
              {
                ledgerAccountId: casinoRevenue.id,
                direction: EntryDirection.CREDIT,
                amount: totalAmount,
              },
            ],
          },
          tx,
        );
      }

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'REGISTER_RENTAL',
          entity: 'Rental',
          entityId: rental.id,
          newState: {
            itemName: rental.itemName,
            totalAmount: rental.totalAmount.toString(),
            customerId: rental.customerId,
          },
        },
      });

      return rental;
    });
  }

  /**
   * Finalizes / returns an active rental.
   */
  async returnRental(
    orgId: string,
    id: string,
    dto: ReturnRentalDto,
    actorId: string,
  ) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!rental) {
      throw new NotFoundException('Registro de alquiler no encontrado.');
    }

    const updated = await this.prisma.rental.update({
      where: { id: rental.id },
      data: {
        endTime: new Date(),
        status: dto.status || RentalStatus.RETURNED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: orgId,
        action: 'RETURN_RENTAL',
        entity: 'Rental',
        entityId: id,
        previousState: { status: rental.status },
        newState: { status: updated.status, endTime: updated.endTime },
      },
    });

    return updated;
  }

  /**
   * Lists rentals with pagination and filters.
   */
  async findAll(orgId: string, query: QueryRentalsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RentalWhereInput = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [total, rentals] = await Promise.all([
      this.prisma.rental.count({ where }),
      this.prisma.rental.findMany({
        where,
        include: {
          customer: true,
          asset: true,
        },
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
      }),
    ]);

    return {
      data: rentals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
