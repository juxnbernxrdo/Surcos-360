# Clarifications & Design Decisions — Students & Institutional Identity Module

## Clarification 1: Central Counterpart Account for Student Initial Balances
- **Question:** When an initial balance is credited to a new student (`StudentAccount`), what is the required counterpart account in the double-entry ledger to satisfy $\sum \text{DEBIT} = \sum \text{CREDIT}$?
- **Decision (PRD v4 §7.1, §8):** Every organization/institution has default ledger accounts. Surcos Saving has a central `INITIAL_CAPITAL_FUND` or `SAVING_CENTRAL_VAULT` account of type `ASSET` or `EQUITY`. When a student account is created with an initial balance of $\$X$, the transaction records:
  - `DEBIT` Central Capital Account (Asset/Fund) $\$X$
  - `CREDIT` Student Account (Liability/Wallet) $\$X$
  If no explicit saving ledger account is specified, the system automatically uses or provisions the default `SAVING_DEFAULT_CAPITAL` account.

## Clarification 2: Token Generation on Student Creation
- **Question:** Should an onboarding registration token (`RegistrationToken`) be returned immediately upon single student creation and in the bulk import response?
- **Decision:** Yes. The admin who creates or imports the students receives the plain-text onboarding registration tokens and redemption links in the API response (and CSV export summary), while only the SHA-256 hash is persisted in the database.

## Clarification 3: Student Dashboard Calculation Consistency
- **Question:** How does the student dashboard compute "Gastos Totales" vs "Saldo Disponible"?
- **Decision (PRD v4 §5):**
  - `initialBalance`: The total sum of `INITIAL_BALANCE` transactions credited to the student.
  - `totalExpenses`: The total sum of `PURCHASE` / `WITHDRAWAL` debits against the student account.
  - `savedAmount` / `deposits`: The sum of subsequent `DEPOSIT` transactions.
  - `currentBalance`: $\text{initialBalance} + \text{savedAmount} - \text{totalExpenses}$, which strictly equals $\sum \text{CREDITS} - \sum \text{DEBITS}$ from the append-only ledger.

## Clarification 4: Student Role & 3-Layer Security
- **Question:** Can a student call `/students` to list other students or lookup other accounts?
- **Decision (PRD v4 §5, §11.2):** No. The endpoint `/students/me/dashboard` and `/students/me/statement` resolves `InstitutionalPerson` via JWT `auth.uid()`. Endpoints `/students`, `/students/:id`, and `/students/import` are strictly guarded with `@Roles(UserType.AUTHORITY, UserType.TEACHER)`.
