import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  QueryAssetsDto,
} from '../dto/asset.dto';
import {
  Prisma,
  AssetStatus,
  TransactionType,
  EntryDirection,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a new fixed asset.
   */
  async createAsset(orgId: string, dto: CreateAssetDto, actorId: string) {
    const existing = await this.prisma.asset.findUnique({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un activo con el código '${dto.code}' en esta organización.`,
      );
    }

    const acquisitionCost = new Decimal(dto.acquisitionCost);
    const currentValuation = dto.currentValuation
      ? new Decimal(dto.currentValuation)
      : acquisitionCost;
    const salePrice = dto.salePrice ? new Decimal(dto.salePrice) : null;

    const asset = await this.prisma.$transaction(async (tx) => {
      const createdAsset = await tx.asset.create({
        data: {
          organizationId: orgId,
          code: dto.code.trim().toUpperCase(),
          serialNumber: dto.serialNumber?.trim() || null,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          type: dto.type,
          acquisitionCost,
          currentValuation,
          physicalLocation: dto.physicalLocation?.trim() || null,
          responsibleId: dto.responsibleId || null,
          isAvailableForSale: dto.isAvailableForSale ?? false,
          salePrice,
          status: AssetStatus.ACTIVE,
        },
      });

      if (acquisitionCost.greaterThan(0)) {
        const org = await tx.organization.findUnique({
          where: { id: orgId },
        });
        const orgCode = org?.code || 'ORG';

        const fixedAssetAccount =
          await this.ledgerService.getOrganizationAccount(
            orgId,
            `${orgCode}_FIXED_ASSETS`,
            tx,
          );
        const cashVault = await this.ledgerService.getOrganizationAccount(
          orgId,
          `${orgCode}_CASH_VAULT`,
          tx,
        );

        await this.ledgerService.createTransaction(
          {
            type: TransactionType.ASSET_PURCHASE,
            description: `Alta de Activo Fijo Patrimonial: ${createdAsset.name} (${createdAsset.code})`,
            referenceType: 'ASSET',
            referenceId: createdAsset.id,
            organizationId: orgId,
            actorId,
            entries: [
              {
                ledgerAccountId: fixedAssetAccount.id,
                direction: EntryDirection.DEBIT,
                amount: acquisitionCost,
              },
              {
                ledgerAccountId: cashVault.id,
                direction: EntryDirection.CREDIT,
                amount: acquisitionCost,
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
          action: 'CREATE_ASSET',
          entity: 'Asset',
          entityId: createdAsset.id,
          newState: {
            code: createdAsset.code,
            name: createdAsset.name,
            acquisitionCost: createdAsset.acquisitionCost.toString(),
          },
        },
      });

      return createdAsset;
    });

    return asset;
  }

  /**
   * Lists assets for an organization with pagination and filters.
   */
  async findAll(orgId: string, query: QueryAssetsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {
      organizationId: orgId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isAvailableForSale !== undefined) {
      where.isAvailableForSale = query.isAvailableForSale;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, assets] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
    ]);

    return {
      data: assets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single asset by ID.
   */
  async findById(orgId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!asset) {
      throw new NotFoundException(`Activo con ID '${id}' no encontrado.`);
    }

    return asset;
  }

  /**
   * Updates an asset.
   */
  async updateAsset(
    orgId: string,
    id: string,
    dto: UpdateAssetDto,
    actorId: string,
  ) {
    const asset = await this.findById(orgId, id);

    const updated = await this.prisma.asset.update({
      where: { id: asset.id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description ? dto.description.trim() : undefined,
        type: dto.type,
        status: dto.status,
        currentValuation:
          dto.currentValuation !== undefined
            ? new Decimal(dto.currentValuation)
            : undefined,
        physicalLocation: dto.physicalLocation?.trim(),
        responsibleId: dto.responsibleId,
        isAvailableForSale: dto.isAvailableForSale,
        salePrice:
          dto.salePrice !== undefined ? new Decimal(dto.salePrice) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: orgId,
        action: 'UPDATE_ASSET',
        entity: 'Asset',
        entityId: id,
        previousState: {
          status: asset.status,
          currentValuation: asset.currentValuation.toString(),
        },
        newState: {
          status: updated.status,
          currentValuation: updated.currentValuation.toString(),
        },
      },
    });

    return updated;
  }
}
