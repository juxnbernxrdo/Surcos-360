-- ============================================================================
-- PostgreSQL Row Level Security (RLS) — Surcos 360
-- Capa 3 del modelo de seguridad en profundidad (§6.4, §11.3, §12.2 PRD v1.0)
--
-- IMPORTANTE (activación):
--   * Ejecutar DESPUÉS de aplicar las migraciones de Prisma (0001_...).
--   * Requiere el esquema `auth` de Supabase (auth.uid() / auth.jwt()).
--   * Los claims utilizados se leen de `auth.jwt()->'app_metadata'`.
--     El backend NestJS los establece por solicitud vía
--     `SET LOCAL request.jwt.claims = '<jwt>'` dentro de la transacción
--     (ver PrismaService.withRlsClaims). Sin claims, RLS deniega por defecto
--     (defensa en profundidad: falla cerrada).
--
-- Tablas financieras protegidas: InstitutionalPerson, StudentProfile,
-- StudentAccount, LedgerAccount, Transaction, LedgerEntry, AuditLog, Sale,
-- SaleItem, Purchase, PurchaseItem, Product, Inventory, InventoryMovement,
-- Asset, Liability, Expense, GymVisit, Rental.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HABILITACIÓN DE RLS
-- ----------------------------------------------------------------------------
ALTER TABLE "InstitutionalPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentProfile"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentAccount"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerAccount"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventory"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Liability"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GymVisit"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rental"               ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. IDENTIDAD INSTITUCIONAL
-- El usuario ve solo su propio registro. Autoridades y motor financiero ven todo.
-- ----------------------------------------------------------------------------
CREATE POLICY "person_select_own_or_global"
ON "InstitutionalPerson" FOR SELECT
USING (
  "userId" = auth.uid()::text
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') = 'AUTHORITY'
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') = 'SURCOS_SAVING'
);

CREATE POLICY "person_insert_via_engine"
ON "InstitutionalPerson" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "person_update_own_or_global"
ON "InstitutionalPerson" FOR UPDATE
USING (
  "userId" = auth.uid()::text
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') = 'AUTHORITY'
);

-- ----------------------------------------------------------------------------
-- 3. CUENTA DE AHORRO ESTUDIANTIL
-- El estudiante solo LEE su propia cuenta. Los escritos pasan por el motor.
-- ----------------------------------------------------------------------------
CREATE POLICY "student_account_select_owner_or_saving"
ON "StudentAccount" FOR SELECT
USING (
  "institutionalPersonId" IN (
    SELECT id FROM "InstitutionalPerson" WHERE "userId" = auth.uid()::text
  )
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING')
);

CREATE POLICY "student_account_insert_via_engine"
ON "StudentAccount" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING')
);

-- ----------------------------------------------------------------------------
-- 4. LIBRO MAYOR (APPEND-ONLY)
-- Los asientos solo los inserta el motor (AUTHORITY / SURCOS_SAVING / ORGANIZATION_MEMBER).
-- Lectura: autoridades, Surcos Saving y el estudiante sobre SU propia cuenta.
-- UPDATE/DELETE quedan bloqueados por los triggers de inmutabilidad y por RLS.
-- ----------------------------------------------------------------------------
CREATE POLICY "ledger_account_select_org_member_or_global"
ON "LedgerAccount" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "ledger_entry_select_own_student_or_global"
ON "LedgerEntry" FOR SELECT
USING (
  "studentAccountId" IS NOT NULL
  AND "studentAccountId" IN (
    SELECT sa.id FROM "StudentAccount" sa
    JOIN "InstitutionalPerson" p ON p.id = sa."institutionalPersonId"
    WHERE p."userId" = auth.uid()::text
  )
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "ledger_entry_insert_via_engine"
ON "LedgerEntry" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "transaction_select_own_student_or_global"
ON "Transaction" FOR SELECT
USING (
  id IN (
    SELECT le."transactionId" FROM "LedgerEntry" le
    JOIN "StudentAccount" sa ON sa.id = le."studentAccountId"
    JOIN "InstitutionalPerson" p ON p.id = sa."institutionalPersonId"
    WHERE p."userId" = auth.uid()::text
  )
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "transaction_insert_via_engine"
ON "Transaction" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

-- ----------------------------------------------------------------------------
-- 5. COMERCIO (PYME)
-- Los estudiantes NO pueden insertar/actualizar operaciones comerciales.
-- ----------------------------------------------------------------------------
CREATE POLICY "sale_insert_org_member_only"
ON "Sale" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "sale_select_org_member_or_student_customer"
ON "Sale" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "purchase_insert_org_member_only"
ON "Purchase" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "purchase_select_org_member_only"
ON "Purchase" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "inventory_update_org_member_only"
ON "Inventory" FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "inventory_select_org_member_only"
ON "Inventory" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "product_select_org_member_or_student_read"
ON "Product" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'ORGANIZATION_MEMBER')
);

-- ----------------------------------------------------------------------------
-- 6. AUDITORÍA (SIN LECTURA DE ESTUDIANTES)
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_log_insert_via_engine"
ON "AuditLog" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "audit_log_select_global_only"
ON "AuditLog" FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('AUTHORITY', 'SURCOS_SAVING')
);