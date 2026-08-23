import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  QueryCustomersDto,
} from '../dto/customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a commercial customer (external or linked to an InstitutionalPerson).
   */
  async createCustomer(orgId: string, dto: CreateCustomerDto, actorId: string) {
    const normalizedName = dto.name.trim();
    const normalizedTaxId = dto.taxId ? dto.taxId.trim().toUpperCase() : null;
    const normalizedEmail = dto.email ? dto.email.trim().toLowerCase() : null;

    // If institutionalPersonId is supplied, check existence and retrieve details
    let linkedPerson = null;
    if (dto.institutionalPersonId) {
      linkedPerson = await this.prisma.institutionalPerson.findUnique({
        where: { id: dto.institutionalPersonId },
        include: { studentAccount: true },
      });

      if (!linkedPerson) {
        throw new BadRequestException(
          `Institutional person with ID '${dto.institutionalPersonId}' does not exist.`,
        );
      }
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          organizationId: orgId,
          name: normalizedName,
          email: normalizedEmail || (linkedPerson ? linkedPerson.email : null),
          phone: dto.phone ? dto.phone.trim() : null,
          taxId:
            normalizedTaxId ||
            (linkedPerson ? linkedPerson.institutionalCode : null),
          customerType:
            dto.customerType ||
            (linkedPerson ? linkedPerson.userType : 'EXTERNAL'),
          institutionalPersonId: dto.institutionalPersonId || null,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'CREATE_CUSTOMER',
          entity: 'Customer',
          entityId: c.id,
          newState: {
            name: c.name,
            customerType: c.customerType,
            taxId: c.taxId,
            institutionalPersonId: c.institutionalPersonId,
          },
        },
      });

      return c;
    });

    return customer;
  }

  /**
   * Multi-tenant query for customers with sales summary.
   */
  async findAll(orgId: string, query: QueryCustomersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      OR: [
        { organizationId: orgId },
        { organizationId: null }, // Global institutional customers (e.g. students)
      ],
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.customerType) {
      where.customerType = query.customerType;
    }

    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { taxId: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          institutionalPerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              userType: true,
              email: true,
              institutionalCode: true,
              studentAccount: {
                select: {
                  id: true,
                  accountNumber: true,
                },
              },
            },
          },
          sales: {
            where: { organizationId: orgId },
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

    const formatted = customers.map((c) => {
      const totalPurchases = c.sales.reduce(
        (sum, s) => sum + Number(s.totalAmount.toString()),
        0,
      );

      return {
        id: c.id,
        organizationId: c.organizationId,
        name:
          c.name ||
          (c.institutionalPerson
            ? `${c.institutionalPerson.firstName} ${c.institutionalPerson.lastName}`
            : 'Cliente Sin Nombre'),
        email: c.email || c.institutionalPerson?.email,
        phone: c.phone,
        taxId: c.taxId || c.institutionalPerson?.institutionalCode,
        customerType: c.customerType,
        isActive: c.isActive,
        isInstitutional: !!c.institutionalPersonId,
        institutionalPerson: c.institutionalPerson,
        salesCount: c.sales.length,
        totalSpent: Number(totalPurchases.toFixed(2)),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
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
   * Retrieves single customer details.
   */
  async findById(orgId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        institutionalPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userType: true,
            email: true,
            institutionalCode: true,
            studentAccount: {
              select: {
                id: true,
                accountNumber: true,
              },
            },
          },
        },
        sales: {
          where: { organizationId: orgId },
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

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found.`);
    }

    const totalSpent = customer.sales.reduce(
      (sum, s) => sum + Number(s.totalAmount.toString()),
      0,
    );

    return {
      id: customer.id,
      organizationId: customer.organizationId,
      name:
        customer.name ||
        (customer.institutionalPerson
          ? `${customer.institutionalPerson.firstName} ${customer.institutionalPerson.lastName}`
          : 'Cliente Sin Nombre'),
      email: customer.email || customer.institutionalPerson?.email,
      phone: customer.phone,
      taxId: customer.taxId || customer.institutionalPerson?.institutionalCode,
      customerType: customer.customerType,
      isActive: customer.isActive,
      isInstitutional: !!customer.institutionalPersonId,
      institutionalPerson: customer.institutionalPerson,
      salesCount: customer.sales.length,
      totalSpent: Number(totalSpent.toFixed(2)),
      recentSales: customer.sales.map((s) => ({
        id: s.id,
        totalAmount: Number(s.totalAmount.toFixed(2)),
        grossProfit: Number(s.grossProfit.toFixed(2)),
        paymentMethod: s.paymentMethod,
        status: s.status,
        itemCount: s.items.length,
        createdAt: s.createdAt,
      })),
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  /**
   * Updates customer profile.
   */
  async updateCustomer(
    orgId: string,
    id: string,
    dto: UpdateCustomerDto,
    actorId: string,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          taxId:
            dto.taxId !== undefined
              ? dto.taxId?.trim().toUpperCase()
              : undefined,
          email:
            dto.email !== undefined
              ? dto.email?.trim().toLowerCase()
              : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
          customerType: dto.customerType || undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'UPDATE_CUSTOMER',
          entity: 'Customer',
          entityId: id,
          previousState: {
            name: customer.name,
            customerType: customer.customerType,
            isActive: customer.isActive,
          },
          newState: { ...dto },
        },
      });

      return updated;
    });
  }
}
