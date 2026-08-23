import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { CreateGymVisitDto, QueryGymVisitsDto } from '../dto/gym-visit.dto';
import {
  Prisma,
  VisitType,
  VisitStatus,
  TransactionType,
  EntryDirection,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class GymService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a gym visit (FREE or PAID) for Surcos Fit (§9.2 PRD v1.0).
   */
  async createVisit(orgId: string, dto: CreateGymVisitDto, actorId: string) {
    const isPaid = dto.visitType === VisitType.PAID;
    const amountDecimal =
      isPaid && dto.amount ? new Decimal(dto.amount) : new Decimal(0);

    if (isPaid && amountDecimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Las visitas de modalidad pagada (PAID) requieren un monto mayor a cero.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create GymVisit record
      const visit = await tx.gymVisit.create({
        data: {
          organizationId: orgId,
          studentId: dto.studentId || null,
          customerId: dto.customerId || null,
          visitType: dto.visitType || VisitType.FREE,
          amount: amountDecimal,
          registeredBy: actorId,
          status: VisitStatus.COMPLETED,
          notes: dto.notes?.trim() || null,
        },
      });

      // 2. If PAID and has studentId, post ledger transaction from student wallet to Surcos Fit Revenue
      if (isPaid && dto.studentId && amountDecimal.greaterThan(0)) {
        const studentAccount = await tx.studentAccount.findUnique({
          where: { institutionalPersonId: dto.studentId },
        });

        if (studentAccount) {
          // Verificación de saldo bajo bloqueo de fila (evita doble gasto TOCTOU)
          await this.ledgerService.lockStudentAccount(studentAccount.id, tx);

          const balance = await this.ledgerService.getStudentAccountBalance(
            studentAccount.id,
            tx,
          );

          if (balance.lessThan(amountDecimal)) {
            throw new BadRequestException(
              `Saldo insuficiente en la cuenta del estudiante (Disponible: $${balance.toString()}).`,
            );
          }

          const org = await tx.organization.findUnique({
            where: { id: orgId },
          });
          const orgCode = org?.code || 'FIT';

          const fitRevenue = await this.ledgerService.getOrganizationAccount(
            orgId,
            `${orgCode}_REVENUE`,
            tx,
          );

          await this.ledgerService.createTransaction(
            {
              type: TransactionType.VISIT_FEE,
              description: `Pase diario de entrenamiento en Surcos Fit`,
              referenceType: 'VISIT',
              referenceId: visit.id,
              organizationId: orgId,
              actorId,
              entries: [
                {
                  studentAccountId: studentAccount.id,
                  direction: EntryDirection.DEBIT,
                  amount: amountDecimal,
                },
                {
                  ledgerAccountId: fitRevenue.id,
                  direction: EntryDirection.CREDIT,
                  amount: amountDecimal,
                },
              ],
            },
            tx,
          );
        }
      }

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'REGISTER_GYM_VISIT',
          entity: 'GymVisit',
          entityId: visit.id,
          newState: {
            visitType: visit.visitType,
            amount: visit.amount.toString(),
            studentId: visit.studentId,
          },
        },
      });

      return visit;
    });
  }

  /**
   * Lists gym visits with pagination and filtering.
   */
  async findAllVisits(orgId: string, query: QueryGymVisitsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.GymVisitWhereInput = {
      organizationId: orgId,
    };

    if (query.visitType) {
      where.visitType = query.visitType;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, visits] = await Promise.all([
      this.prisma.gymVisit.count({ where }),
      this.prisma.gymVisit.findMany({
        where,
        include: {
          student: true,
          customer: true,
        },
        skip,
        take: limit,
        orderBy: { checkIn: 'desc' },
      }),
    ]);

    return {
      data: visits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
