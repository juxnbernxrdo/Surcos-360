import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  QuerySuppliersDto,
} from '../dto/supplier.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a commercial supplier (external or linked to an InstitutionalPerson).
   */
  async createSupplier(orgId: string, dto: CreateSupplierDto, actorId: string) {
    const normalizedName = dto.name.trim();
    const normalizedTaxId = dto.taxId ? dto.taxId.trim().toUpperCase() : null;
    const normalizedEmail = dto.email ? dto.email.trim().toLowerCase() : null;

    // Check duplicate taxId within the same organization if supplied
    if (normalizedTaxId) {
      const existingTaxId = await this.prisma.supplier.findFirst({
        where: {
          organizationId: orgId,
          taxId: normalizedTaxId,
        },
      });

      if (existingTaxId) {
        throw new ConflictException(
          `Supplier with Tax ID / RUC '${dto.taxId}' already exists in this organization.`,
        );
      }
    }

    // If institutionalPersonId is provided, verify it exists
    if (dto.institutionalPersonId) {
      const person = await this.prisma.institutionalPerson.findUnique({
        where: { id: dto.institutionalPersonId },
      });

      if (!person) {
        throw new BadRequestException(
          `Institutional person with ID '${dto.institutionalPersonId}' does not exist.`,
        );
      }
    }

    const supplier = await this.prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: {
          organizationId: orgId,
          name: normalizedName,
          companyName: dto.companyName ? dto.companyName.trim() : null,
          taxId: normalizedTaxId,
          email: normalizedEmail,
          phone: dto.phone ? dto.phone.trim() : null,
          address: dto.address ? dto.address.trim() : null,
          paymentTerms: dto.paymentTerms ? dto.paymentTerms.trim() : 'CONTADO',
          institutionalPersonId: dto.institutionalPersonId || null,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'CREATE_SUPPLIER',
          entity: 'Supplier',
          entityId: s.id,
          newState: {
            name: s.name,
            companyName: s.companyName,
            taxId: s.taxId,
            institutionalPersonId: s.institutionalPersonId,
          },
        },
      });

      return s;
    });

    return supplier;
  }

  /**
   * Multi-tenant query for suppliers with purchase aggregation.
   */
  async findAll(orgId: string, query: QuerySuppliersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      organizationId: orgId,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { taxId: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: {
          institutionalPerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              userType: true,
              email: true,
            },
          },
          purchases: {
            select: {
              id: true,
              totalAmount: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = suppliers.map((s) => {
      const totalPurchasesAmount = s.purchases.reduce(
        (sum, p) => sum + Number(p.totalAmount.toString()),
        0,
      );

      return {
        id: s.id,
        organizationId: s.organizationId,
        name: s.name,
        companyName: s.companyName,
        taxId: s.taxId,
        email: s.email,
        phone: s.phone,
        address: s.address,
        paymentTerms: s.paymentTerms,
        isActive: s.isActive,
        isInternalPerson: !!s.institutionalPersonId,
        institutionalPerson: s.institutionalPerson,
        purchasesCount: s.purchases.length,
        totalPurchasesAmount: Number(totalPurchasesAmount.toFixed(2)),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single supplier by ID with detailed purchase history.
   */
  async findById(orgId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId: orgId },
      include: {
        institutionalPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userType: true,
            email: true,
            institutionalCode: true,
          },
        },
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID '${id}' not found in organization.`,
      );
    }

    const totalPurchasesAmount = supplier.purchases.reduce(
      (sum, p) => sum + Number(p.totalAmount.toString()),
      0,
    );

    return {
      id: supplier.id,
      organizationId: supplier.organizationId,
      name: supplier.name,
      companyName: supplier.companyName,
      taxId: supplier.taxId,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      paymentTerms: supplier.paymentTerms,
      isActive: supplier.isActive,
      isInternalPerson: !!supplier.institutionalPersonId,
      institutionalPerson: supplier.institutionalPerson,
      purchasesCount: supplier.purchases.length,
      totalPurchasesAmount: Number(totalPurchasesAmount.toFixed(2)),
      recentPurchases: supplier.purchases.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        totalAmount: Number(p.totalAmount.toFixed(2)),
        status: p.status,
        itemCount: p.items.length,
        createdAt: p.createdAt,
      })),
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  /**
   * Updates supplier information safely.
   */
  async updateSupplier(
    orgId: string,
    id: string,
    dto: UpdateSupplierDto,
    actorId: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID '${id}' not found in organization.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          companyName:
            dto.companyName !== undefined ? dto.companyName?.trim() : undefined,
          taxId:
            dto.taxId !== undefined
              ? dto.taxId?.trim().toUpperCase()
              : undefined,
          email:
            dto.email !== undefined
              ? dto.email?.trim().toLowerCase()
              : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
          address: dto.address !== undefined ? dto.address?.trim() : undefined,
          paymentTerms:
            dto.paymentTerms !== undefined
              ? dto.paymentTerms?.trim()
              : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'UPDATE_SUPPLIER',
          entity: 'Supplier',
          entityId: id,
          previousState: {
            name: supplier.name,
            taxId: supplier.taxId,
            isActive: supplier.isActive,
          },
          newState: { ...dto },
        },
      });

      return updated;
    });
  }
}
