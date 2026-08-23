-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'TEACHER', 'AUTHORITY', 'REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('STUDENT', 'TEACHER', 'AUTHORITY', 'REPRESENTATIVE', 'PYME_MEMBER');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'STUDENT_WALLET');

-- CreateEnum
CREATE TYPE "EntryDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INITIAL_BALANCE', 'DEPOSIT', 'WITHDRAWAL', 'PURCHASE', 'SALE', 'REFUND', 'TRANSFER', 'ADJUSTMENT', 'EXPENSE', 'RENTAL_FEE', 'VISIT_FEE', 'REVERSAL', 'LIABILITY_PAYMENT', 'ASSET_PURCHASE', 'ASSET_SALE', 'COGS');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'RAW_MATERIAL', 'SUPPLY', 'CONSUMABLE', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'DAMAGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN', 'LOSS');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('RECEIVED', 'PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STUDENT_ACCOUNT', 'CASH', 'TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('EQUIPMENT', 'FURNITURE', 'MACHINERY', 'VEHICLE', 'COMPUTER', 'GAME', 'SPORTS_MATERIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DAMAGED', 'SOLD', 'DISPOSED');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('ACCOUNTS_PAYABLE', 'LOAN', 'CREDIT', 'OBLIGATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LiabilityStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "InstitutionalPerson" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL DEFAULT 'default-institution',
    "userType" "UserType" NOT NULL DEFAULT 'STUDENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "institutionalCode" TEXT NOT NULL,
    "userId" TEXT,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionalPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "academicYear" TEXT DEFAULT '2026-2027',
    "tutor" TEXT,
    "representativeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "department" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityProfile" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "charge" TEXT,
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentativeProfile" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "identificationNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepresentativeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isPyme" BOOLEAN NOT NULL DEFAULT true,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'USER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'USER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationToken" (
    "id" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" TEXT NOT NULL,
    "institutionalPersonId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "organizationId" TEXT,
    "reversalOfId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "studentAccountId" TEXT,
    "ledgerAccountId" TEXT,
    "direction" "EntryDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "responseData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "institutionalPersonId" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "institutionalPersonId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "salePrice" DECIMAL(12,2) NOT NULL,
    "averageCost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL DEFAULT 'Bodega Principal',
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "previousStock" DECIMAL(12,2) NOT NULL,
    "newStock" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serialNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssetType" NOT NULL DEFAULT 'EQUIPMENT',
    "acquisitionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "currentValuation" DECIMAL(12,2) NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "physicalLocation" TEXT,
    "responsibleId" TEXT,
    "isAvailableForSale" BOOLEAN NOT NULL DEFAULT false,
    "salePrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LiabilityType" NOT NULL DEFAULT 'ACCOUNTS_PAYABLE',
    "description" TEXT NOT NULL,
    "supplierId" TEXT,
    "initialAmount" DECIMAL(12,2) NOT NULL,
    "outstandingBalance" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "LiabilityStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "actorId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "invoiceNumber" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "paymentTerms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "grossProfit" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STUDENT_ACCOUNT',
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "assetId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT,
    "customerId" TEXT,
    "visitType" "VisitType" NOT NULL DEFAULT 'FREE',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "checkIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" TIMESTAMP(3),
    "registeredBy" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT,
    "productId" TEXT,
    "customerId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "durationHours" DECIMAL(12,2) NOT NULL DEFAULT 1.0,
    "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "RentalStatus" NOT NULL DEFAULT 'ACTIVE',
    "registeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalPerson_email_key" ON "InstitutionalPerson"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalPerson_institutionalCode_key" ON "InstitutionalPerson"("institutionalCode");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalPerson_userId_key" ON "InstitutionalPerson"("userId");

-- CreateIndex
CREATE INDEX "InstitutionalPerson_institutionId_idx" ON "InstitutionalPerson"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionalPerson_email_idx" ON "InstitutionalPerson"("email");

-- CreateIndex
CREATE INDEX "InstitutionalPerson_institutionalCode_idx" ON "InstitutionalPerson"("institutionalCode");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_institutionalPersonId_key" ON "StudentProfile"("institutionalPersonId");

-- CreateIndex
CREATE INDEX "StudentProfile_course_idx" ON "StudentProfile"("course");

-- CreateIndex
CREATE INDEX "StudentProfile_representativeId_idx" ON "StudentProfile"("representativeId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_institutionalPersonId_key" ON "TeacherProfile"("institutionalPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorityProfile_institutionalPersonId_key" ON "AuthorityProfile"("institutionalPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentativeProfile_institutionalPersonId_key" ON "RepresentativeProfile"("institutionalPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Organization_code_idx" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_institutionalPersonId_idx" ON "Membership"("institutionalPersonId");

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_institutionalPersonId_organizationId_key" ON "Membership"("institutionalPersonId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_tokenHash_idx" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationToken_tokenHash_key" ON "RegistrationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RegistrationToken_tokenHash_idx" ON "RegistrationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_institutionalPersonId_key" ON "StudentAccount"("institutionalPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_accountNumber_key" ON "StudentAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "StudentAccount_accountNumber_idx" ON "StudentAccount"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_organizationId_code_key" ON "LedgerAccount"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionNumber_key" ON "Transaction"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_referenceType_referenceId_idx" ON "Transaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_reversalOfId_idx" ON "Transaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_actorId_idx" ON "Transaction"("actorId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_studentAccountId_idx" ON "LedgerEntry"("studentAccountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerAccountId_idx" ON "LedgerEntry"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_studentAccountId_createdAt_idx" ON "LedgerEntry"("studentAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerAccountId_createdAt_idx" ON "LedgerEntry"("ledgerAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_actorId_endpoint_key" ON "IdempotencyKey"("key", "actorId", "endpoint");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");

-- CreateIndex
CREATE INDEX "Supplier_institutionalPersonId_idx" ON "Supplier"("institutionalPersonId");

-- CreateIndex
CREATE INDEX "Supplier_taxId_idx" ON "Supplier"("taxId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_institutionalPersonId_idx" ON "Customer"("institutionalPersonId");

-- CreateIndex
CREATE INDEX "Customer_taxId_idx" ON "Customer"("taxId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "Inventory_organizationId_idx" ON "Inventory"("organizationId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_locationName_key" ON "Inventory"("productId", "locationName");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Asset_organizationId_idx" ON "Asset"("organizationId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_organizationId_code_key" ON "Asset"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Liability_organizationId_idx" ON "Liability"("organizationId");

-- CreateIndex
CREATE INDEX "Liability_status_idx" ON "Liability"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Liability_organizationId_code_key" ON "Liability"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Expense_organizationId_idx" ON "Expense"("organizationId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE INDEX "Purchase_organizationId_idx" ON "Purchase"("organizationId");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "Sale_organizationId_idx" ON "Sale"("organizationId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_assetId_idx" ON "SaleItem"("assetId");

-- CreateIndex
CREATE INDEX "GymVisit_organizationId_idx" ON "GymVisit"("organizationId");

-- CreateIndex
CREATE INDEX "GymVisit_studentId_idx" ON "GymVisit"("studentId");

-- CreateIndex
CREATE INDEX "GymVisit_visitType_idx" ON "GymVisit"("visitType");

-- CreateIndex
CREATE INDEX "Rental_organizationId_idx" ON "Rental"("organizationId");

-- CreateIndex
CREATE INDEX "Rental_customerId_idx" ON "Rental"("customerId");

-- CreateIndex
CREATE INDEX "Rental_status_idx" ON "Rental"("status");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "RepresentativeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityProfile" ADD CONSTRAINT "AuthorityProfile_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentativeProfile" ADD CONSTRAINT "RepresentativeProfile_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "InstitutionalPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "InstitutionalPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationToken" ADD CONSTRAINT "RegistrationToken_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "InstitutionalPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_institutionalPersonId_fkey" FOREIGN KEY ("institutionalPersonId") REFERENCES "InstitutionalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "InstitutionalPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- LEDGER IMMUTABILITY — APPEND-ONLY GUARANTEES (§7.3.1 PRD v1.0)
-- ============================================================
-- Las transacciones contables y sus asientos son de solo inserción.
-- Se bloquean UPDATE y DELETE a nivel de base de datos.

CREATE OR REPLACE FUNCTION surcos_block_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger % es append-only: no se permiten operaciones UPDATE o DELETE.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_transaction_no_update
BEFORE UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION surcos_block_ledger_mutation();

CREATE TRIGGER trg_transaction_no_delete
BEFORE DELETE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION surcos_block_ledger_mutation();

CREATE TRIGGER trg_ledger_entry_no_update
BEFORE UPDATE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION surcos_block_ledger_mutation();

CREATE TRIGGER trg_ledger_entry_no_delete
BEFORE DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION surcos_block_ledger_mutation();

-- ============================================================
-- SINGLE-ADMIN INVARIANT PER ORGANIZATION (§4.2 PRD v1.0)
-- Único índice parcial: exactamente un ADMIN activo por organización.
-- ============================================================
CREATE UNIQUE INDEX "Membership_single_active_admin_idx"
ON "Membership"("organizationId")
WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE';
