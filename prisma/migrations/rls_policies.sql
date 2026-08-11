-- PostgreSQL RLS Security Policies for Surcos 360 V0
-- Execute after Prisma migrations

-- Enable RLS on core tables
ALTER TABLE "InstitutionalPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;

-- 1. InstitutionalPerson Policies
CREATE POLICY "Users can read own person record or admins read all"
ON "InstitutionalPerson" FOR SELECT
USING (
  "userId" = auth.uid()::text 
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') = 'ADMIN'
);

-- 2. StudentAccount & Ledger Policies (Student restricts write, read own account)
CREATE POLICY "Students can view own StudentAccount"
ON "StudentAccount" FOR SELECT
USING (
  "institutionalPersonId" IN (
    SELECT id FROM "InstitutionalPerson" WHERE "userId" = auth.uid()::text
  )
  OR (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('ADMIN', 'SAVING_MEMBER')
);

CREATE POLICY "Only NestJS / Financial Engine can insert LedgerEntry"
ON "LedgerEntry" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('ADMIN', 'SAVING_MEMBER', 'ORGANIZATION_MEMBER')
);

-- 3. PYME Commercial Operations Policies (AgroRed)
CREATE POLICY "Students cannot write Sales or Inventories"
ON "Sale" FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('ADMIN', 'ORGANIZATION_MEMBER')
);

CREATE POLICY "Students cannot update Inventories"
ON "Inventory" FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' ->> 'global_role') IN ('ADMIN', 'ORGANIZATION_MEMBER')
);
