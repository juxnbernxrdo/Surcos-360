import { AccountType } from '@prisma/client';

export interface StandardAccountDef {
  code: string;
  name: string;
  type: AccountType;
  description: string;
}

/**
 * Standard Chart of Accounts (Plan de Cuentas Estándar) for Surcos 360 Organizations.
 * (§7 & §8 PRD v1.0)
 */
export const StandardAccountCodes = {
  // Surcos Saving (Admin & Central Governance)
  SAVING_CENTRAL_VAULT: 'SAVING_CENTRAL_VAULT',
  STUDENT_SAVINGS_LIABILITY: 'STUDENT_SAVINGS_LIABILITY',

  // PYMES Accounts (AgroRed, Surcos Fit, Surcasino, and future PYMEs)
  CASH_VAULT: 'CASH_VAULT',
  INVENTORY_ASSET: 'INVENTORY_ASSET',
  FIXED_ASSETS: 'FIXED_ASSETS',
  REVENUE: 'REVENUE',
  COGS: 'COGS',
  OPERATING_EXPENSE: 'OPERATING_EXPENSE',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',
  ASSET_SALE_REVENUE: 'ASSET_SALE_REVENUE',
} as const;

export function getPymeStandardAccounts(
  orgCode: string,
  orgName: string,
): StandardAccountDef[] {
  const prefix = orgCode.toUpperCase();
  return [
    {
      code: `${prefix}_CASH_VAULT`,
      name: `${orgName} - Caja y Efectivo`,
      type: AccountType.ASSET,
      description: `Cuenta de caja, banco o efectivo disponible para ${orgName}`,
    },
    {
      code: `${prefix}_INVENTORY_ASSET`,
      name: `${orgName} - Inventario Circulante`,
      type: AccountType.ASSET,
      description: `Valoración monetaria de existencias comerciales de ${orgName}`,
    },
    {
      code: `${prefix}_FIXED_ASSETS`,
      name: `${orgName} - Activos Fijos Patrimoniales`,
      type: AccountType.ASSET,
      description: `Equipos, mobiliario y bienes duraderos de ${orgName}`,
    },
    {
      code: `${prefix}_REVENUE`,
      name: `${orgName} - Ingresos por Ventas y Servicios`,
      type: AccountType.REVENUE,
      description: `Ingresos operativos derivados de ventas, accesos o alquileres de ${orgName}`,
    },
    {
      code: `${prefix}_COGS`,
      name: `${orgName} - Costo de Ventas (COGS)`,
      type: AccountType.EXPENSE,
      description: `Costo promedio ponderado de los productos comercializados en ${orgName}`,
    },
    {
      code: `${prefix}_OPERATING_EXPENSE`,
      name: `${orgName} - Gastos Operativos`,
      type: AccountType.EXPENSE,
      description: `Gastos de operación, suministros y mantenimiento de ${orgName}`,
    },
    {
      code: `${prefix}_ACCOUNTS_PAYABLE`,
      name: `${orgName} - Cuentas por Pagar (Proveedores)`,
      type: AccountType.LIABILITY,
      description: `Obligaciones y deudas con proveedores de insumos o servicios para ${orgName}`,
    },
    {
      code: `${prefix}_ASSET_SALE_REVENUE`,
      name: `${orgName} - Ingresos por Venta de Activos`,
      type: AccountType.REVENUE,
      description: `Ingresos extraordinarios por enajenación de activos patrimoniales de ${orgName}`,
    },
  ];
}
