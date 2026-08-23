/**
 * Granular Permissions Matrix for Surcos 360 Organizations (§5.2 PRD v1.0)
 * Single Source of Truth for Organizational Permissions.
 */

export const OrgPermission = {
  // Inventory Module
  INVENTORY_READ: 'inventory.read',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_ADJUST: 'inventory.adjust',

  // Sales Module
  SALES_READ: 'sales.read',
  SALES_CREATE: 'sales.create',
  SALES_CANCEL: 'sales.cancel',

  // Purchases Module
  PURCHASES_READ: 'purchases.read',
  PURCHASES_CREATE: 'purchases.create',
  PURCHASES_UPDATE: 'purchases.update',

  // Suppliers Module
  SUPPLIERS_READ: 'suppliers.read',
  SUPPLIERS_MANAGE: 'suppliers.manage',

  // Assets Module
  ASSETS_READ: 'assets.read',
  ASSETS_MANAGE: 'assets.manage',
  ASSETS_SELL: 'assets.sell',

  // Liabilities Module
  LIABILITIES_READ: 'liabilities.read',
  LIABILITIES_MANAGE: 'liabilities.manage',

  // Expenses Module
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_READ: 'expenses.read',

  // Reports & Analytics Module
  REPORTS_READ: 'reports.read',

  // Members & Governance
  MEMBERS_READ: 'members.read',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_MANAGE: 'members.manage',

  // Organization Settings
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
} as const;

export type OrgPermissionType =
  (typeof OrgPermission)[keyof typeof OrgPermission];

export const ALL_ORG_PERMISSIONS: OrgPermissionType[] =
  Object.values(OrgPermission);

export const PERMISSION_DESCRIPTIONS: Record<OrgPermissionType, string> = {
  [OrgPermission.INVENTORY_READ]:
    'Visualizar catálogo de productos, existencias y movimientos',
  [OrgPermission.INVENTORY_CREATE]:
    'Registrar nuevos ítems o productos en los almacenes',
  [OrgPermission.INVENTORY_UPDATE]:
    'Modificar atributos de productos y parámetros de stock',
  [OrgPermission.INVENTORY_ADJUST]:
    'Ejecutar ajustes manuales de stock por merma, rotura o pérdida',
  [OrgPermission.SALES_READ]:
    'Consultar histórico de ventas y comprobantes emitidos',
  [OrgPermission.SALES_CREATE]:
    'Registrar ventas de inventario, servicios o activos',
  [OrgPermission.SALES_CANCEL]:
    'Anular transacciones de venta con reversión en ledger e inventario',
  [OrgPermission.PURCHASES_READ]:
    'Consultar compras realizadas a proveedores y cuentas por pagar',
  [OrgPermission.PURCHASES_CREATE]:
    'Registrar adquisiciones de inventario o activos a proveedores',
  [OrgPermission.PURCHASES_UPDATE]:
    'Actualizar condiciones de compra o recepciones de mercadería',
  [OrgPermission.SUPPLIERS_READ]:
    'Consultar directorio de proveedores comerciales',
  [OrgPermission.SUPPLIERS_MANAGE]:
    'Crear, editar y suspender perfiles de proveedores',
  [OrgPermission.ASSETS_READ]:
    'Visualizar catálogo y estado de activos fijos patrimoniales',
  [OrgPermission.ASSETS_MANAGE]:
    'Registrar altas, transferencias, mantenimiento o bajas de activos',
  [OrgPermission.ASSETS_SELL]:
    'Autorizar y ejecutar la venta de un activo patrimonial',
  [OrgPermission.LIABILITIES_READ]:
    'Consultar obligaciones financieras y cuentas por pagar',
  [OrgPermission.LIABILITIES_MANAGE]:
    'Registrar obligaciones y amortizaciones o pagos a pasivos',
  [OrgPermission.EXPENSES_CREATE]:
    'Registrar egresos y gastos operativos de la PYME',
  [OrgPermission.EXPENSES_READ]: 'Consultar histórico y consolidado de gastos',
  [OrgPermission.REPORTS_READ]:
    'Acceder a balances, estado de resultados y analítica de la PYME',
  [OrgPermission.MEMBERS_READ]:
    'Consultar listado de miembros y membresías de la organización',
  [OrgPermission.MEMBERS_INVITE]:
    'Generar invitaciones para nuevos miembros de la organización',
  [OrgPermission.MEMBERS_MANAGE]:
    'Asignar roles, actualizar permisos o revocar membresías',
  [OrgPermission.ORGANIZATION_READ]:
    'Visualizar información y configuración de la organización',
  [OrgPermission.ORGANIZATION_UPDATE]:
    'Actualizar parámetros operativos y perfil de la organización',
};
