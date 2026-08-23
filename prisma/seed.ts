import 'dotenv/config';
import { PrismaClient, AccountType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Aborting seed.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const StandardAccountCodes = {
  SAVING_CENTRAL_VAULT: 'SAVING_CENTRAL_VAULT',
  STUDENT_SAVINGS_LIABILITY: 'STUDENT_SAVINGS_LIABILITY',
  CASH_VAULT: 'CASH_VAULT',
  INVENTORY_ASSET: 'INVENTORY_ASSET',
  FIXED_ASSETS: 'FIXED_ASSETS',
  REVENUE: 'REVENUE',
  COGS: 'COGS',
  OPERATING_EXPENSE: 'OPERATING_EXPENSE',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',
  ASSET_SALE_REVENUE: 'ASSET_SALE_REVENUE',
} as const;

interface StandardAccountDef {
  code: string;
  name: string;
  type: AccountType;
}

function getPymeStandardAccounts(orgCode: string, orgName: string): StandardAccountDef[] {
  const prefix = orgCode.toUpperCase();
  return [
    {
      code: `${prefix}_CASH_VAULT`,
      name: `${orgName} - Caja y Efectivo`,
      type: AccountType.ASSET,
    },
    {
      code: `${prefix}_INVENTORY_ASSET`,
      name: `${orgName} - Inventario Circulante`,
      type: AccountType.ASSET,
    },
    {
      code: `${prefix}_FIXED_ASSETS`,
      name: `${orgName} - Activos Fijos Patrimoniales`,
      type: AccountType.ASSET,
    },
    {
      code: `${prefix}_REVENUE`,
      name: `${orgName} - Ingresos por Ventas y Servicios`,
      type: AccountType.REVENUE,
    },
    {
      code: `${prefix}_COGS`,
      name: `${orgName} - Costo de Ventas (COGS)`,
      type: AccountType.EXPENSE,
    },
    {
      code: `${prefix}_OPERATING_EXPENSE`,
      name: `${orgName} - Gastos Operativos`,
      type: AccountType.EXPENSE,
    },
    {
      code: `${prefix}_ACCOUNTS_PAYABLE`,
      name: `${orgName} - Cuentas por Pagar (Proveedores)`,
      type: AccountType.LIABILITY,
    },
    {
      code: `${prefix}_ASSET_SALE_REVENUE`,
      name: `${orgName} - Ingresos por Venta de Activos`,
      type: AccountType.REVENUE,
    },
  ];
}

async function main() {
  console.log('Seeding Surcos 360 Core Financial Organizations and Chart of Accounts...');

  // 1. Surcos Saving Central Organization
  const savingOrg = await prisma.organization.upsert({
    where: { code: 'SAVING' },
    update: {},
    create: {
      code: 'SAVING',
      name: 'Surcos Saving Central',
      description: 'Organización Financiera Central y Custodia de Ahorro Estudiantil',
      isPyme: false,
    },
  });
  console.log(`✓ Organization: ${savingOrg.name} (${savingOrg.code})`);

  // Saving Accounts
  await prisma.ledgerAccount.upsert({
    where: {
      organizationId_code: {
        organizationId: savingOrg.id,
        code: StandardAccountCodes.SAVING_CENTRAL_VAULT,
      },
    },
    update: {},
    create: {
      organizationId: savingOrg.id,
      code: StandardAccountCodes.SAVING_CENTRAL_VAULT,
      name: 'Bóveda Central de Ahorro',
      type: AccountType.ASSET,
    },
  });

  await prisma.ledgerAccount.upsert({
    where: {
      organizationId_code: {
        organizationId: savingOrg.id,
        code: StandardAccountCodes.STUDENT_SAVINGS_LIABILITY,
      },
    },
    update: {},
    create: {
      organizationId: savingOrg.id,
      code: StandardAccountCodes.STUDENT_SAVINGS_LIABILITY,
      name: 'Pasivo de Ahorros Estudiantiles Custodiados',
      type: AccountType.LIABILITY,
    },
  });
  console.log(`  ✓ Standard Accounts created for ${savingOrg.code}`);

  // 2. PYMEs
  const pymes = [
    {
      code: 'AGRORED',
      name: 'AgroRed',
      description: 'PYME de Producción y Comercialización Agrícola y Alimentos',
    },
    {
      code: 'FIT',
      name: 'Surcos Fit',
      description: 'PYME de Acondicionamiento Físico, Deporte y Gimnasio',
    },
    {
      code: 'SURCASINO',
      name: 'Surcasino',
      description: 'PYME de Entretenimiento, Alquiler de Juegos y Actividades Lúdicas',
    },
  ];

  for (const pyme of pymes) {
    const org = await prisma.organization.upsert({
      where: { code: pyme.code },
      update: {},
      create: {
        code: pyme.code,
        name: pyme.name,
        description: pyme.description,
        isPyme: true,
      },
    });
    console.log(`✓ Organization: ${org.name} (${org.code})`);

    const standardAccounts = getPymeStandardAccounts(org.code, org.name);
    for (const acc of standardAccounts) {
      await prisma.ledgerAccount.upsert({
        where: {
          organizationId_code: {
            organizationId: org.id,
            code: acc.code,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
        },
      });
    }
    console.log(`  ✓ Standard Chart of Accounts (8 accounts) provisioned for ${org.code}`);
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
