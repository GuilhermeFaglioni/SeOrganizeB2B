# Financial Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Financial workspace — Overview, Contracts,
Receivables and Clients — with decimal-safe money, civil dates, server-side
lists and CSV exports, on the existing Next.js/Prisma stack.

**Architecture:** A dedicated `src/lib/financial` domain layer owns money and
civil-date arithmetic, installment schedules, metrics, lifecycle transitions
and upsell/downsell rules as pure functions; transactional service modules wrap
every multi-record operation (activation, cancellation, renewal, adjustment,
recurring extension) in `prisma.$transaction`. API routes are thin
authenticated adapters over the services. React Query hooks own client reads
and mutations; UI components render forms, tables, an SVG chart and KPI cards
without duplicating domain math.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma 5 +
PostgreSQL, Supabase Auth, TanStack Query 5, Radix/shadcn, Lucide, Tailwind,
Vitest. No new runtime dependencies are required (Prisma ships decimal.js).

**Execution constraints:** Work on `feat/financial-module`. One implementation
agent writes at a time; never edit files in parallel. Never modify paid
installments. Continuous authorization is granted to commit after each task.
Pushing the branch (`feat/financial-module`) and opening the single pull request
is authorized only after Task 18 gates are green and the final integrated
review is `APPROVED`. Apply the new migration only when the local database is
reachable; otherwise validate without applying and note it.

---

## File Responsibility Map

### Domain

- `src/lib/financial/types.ts`: status, duration, frequency, payment and
  installment constants plus shared interfaces.
- `src/lib/financial/money.ts`: `Prisma.Decimal` helpers and BRL formatting.
- `src/lib/financial/civil-date.ts`: `YYYY-MM-DD` validation and arithmetic.
- `src/lib/financial/contract-code.ts`: `CTR-YYYY-NNNN` generation.
- `src/lib/financial/installments.ts`: equal split, finite plans, recurring
  horizon plans, plan-sum validation.
- `src/lib/financial/metrics.ts`: MRR/ARR, forecast, received, overdue, monthly
  grouping, expiring-soon and active contracted value.
- `src/lib/financial/lifecycle.ts`: transition map, activation rules,
  cancellation plan, renewal predicate.
- `src/lib/financial/changes.ts`: upsell/downsell redistribution and
  adjustment proposals plus validation.
- `src/lib/financial/audit.ts`: transactional `ContractAudit` recorder.
- `src/lib/financial/contracts-service.ts`: transactional contract operations.
- `src/lib/financial/installments-service.ts`: payment, cancellation, refund
  and rolling 12-month horizon extension.
- `src/lib/financial/overview-service.ts`: server-side KPI/chart aggregation.
- `src/lib/financial/http.ts`: `qs` and `fetchJson` helpers for hooks.

### Persistence

- `prisma/schema.prisma`: Client, Contract, ContractItem, ContractProject,
  Installment, ContractChange and ContractAudit models.
- `prisma/migrations/20260802120000_financial_module/migration.sql`: additive
  financial tables.

### APIs

- `src/app/api/clients/route.ts`: list (search/pagination) and create.
- `src/app/api/clients/[id]/route.ts`: detail, patch, deactivate.
- `src/app/api/contracts/route.ts`: list (search/filters/sort/pagination) and
  draft creation.
- `src/app/api/contracts/[id]/route.ts`: detail, patch, draft deletion.
- `src/app/api/contracts/[id]/lifecycle/route.ts`: activate, suspend, resume,
  close, cancel, renew.
- `src/app/api/contracts/[id]/changes/route.ts`: upsell/downsell proposal and
  confirmation.
- `src/app/api/installments/[id]/route.ts`: mark paid, cancel.
- `src/app/api/installments/[id]/refund/route.ts`: linked refund.
- `src/app/api/financial/overview/route.ts`: KPIs, chart, action lists.
- `src/app/api/financial/exports/contracts/route.ts`: filtered CSV export.
- `src/app/api/financial/exports/receivables/route.ts`: filtered CSV export.

### Hooks

- `src/hooks/use-clients.ts`: list, detail, create, update, deactivate.
- `src/hooks/use-contracts.ts`: list, detail, create, update, delete,
  lifecycle, change.
- `src/hooks/use-installments.ts`: pay, cancel, refund.
- `src/hooks/use-overview.ts`: overview query with global filters.
- `src/hooks/use-financial-exports.ts`: contract/receivable CSV downloads.

### UI and state

- `src/app/(authenticated)/financial/layout.tsx`: section tab bar.
- `src/app/(authenticated)/financial/page.tsx`: Overview.
- `src/app/(authenticated)/financial/contracts/page.tsx`: contract list.
- `src/app/(authenticated)/financial/contracts/new/page.tsx`: contract form.
- `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`: detail.
- `src/app/(authenticated)/financial/receivables/page.tsx`: installment list.
- `src/app/(authenticated)/financial/clients/page.tsx`: client list.
- `src/app/(authenticated)/financial/clients/new/page.tsx`: client form.
- `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`: detail.
- `src/components/layout/sidebar.tsx`: add Financial nav item.
- `src/components/financial/*`: tabs, filters, KPI cards, SVG chart, tables,
  forms, dialogs, badges, money/date text, CSV button, empty/error states.

### Tests

- `src/__tests__/financial-schema.test.ts`
- `src/__tests__/financial-money.test.ts`
- `src/__tests__/financial-installments.test.ts`
- `src/__tests__/financial-metrics.test.ts`
- `src/__tests__/financial-lifecycle.test.ts`
- `src/__tests__/financial-services.test.ts`
- `src/__tests__/financial-clients-api.test.ts`
- `src/__tests__/financial-contracts-api.test.ts`
- `src/__tests__/financial-operations-api.test.ts`
- `src/__tests__/financial-overview-api.test.ts`
- `src/__tests__/financial-exports.test.ts`
- `src/__tests__/financial-hooks.test.ts`
- `src/__tests__/financial-overview-ui.test.ts`
- `src/__tests__/financial-contracts-ui.test.ts`
- `src/__tests__/financial-receivables-ui.test.ts`
- `src/__tests__/financial-clients-ui.test.ts`
- `src/__tests__/financial-responsiveness.test.ts`

---

### Task 1: Add Financial Persistence Models and Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260802120000_financial_module/migration.sql`
- Create: `src/__tests__/financial-schema.test.ts`

- [ ] **Step 1: Write the failing schema contract test**

Create `src/__tests__/financial-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(
  resolve(__dirname, "../../prisma/schema.prisma"),
  "utf-8"
);
const migration = readFileSync(
  resolve(
    __dirname,
    "../../prisma/migrations/20260802120000_financial_module/migration.sql"
  ),
  "utf-8"
);

describe("financial module schema", () => {
  it.each([
    "Client",
    "Contract",
    "ContractItem",
    "ContractProject",
    "Installment",
    "ContractChange",
    "ContractAudit",
  ])("defines %s", (model) => expect(schema).toContain(`model ${model} {`));

  it("stores money as decimal and dates as civil strings", () => {
    expect(schema).toContain("@db.Decimal(14, 2)");
    expect(schema).toContain('startDate       String   @map("start_date")');
    expect(schema).toContain('dueDate         String   @map("due_date")');
  });

  it("keeps the contract code unique and the client cpf/cnpj unique", () => {
    expect(schema).toContain("code             String   @unique");
    expect(schema).toContain("@@unique([cpfCnpj])");
  });

  it("guards against duplicate recurring installments per cycle", () => {
    expect(schema).toContain("@@unique([contractId, cycleKey])");
  });

  it("keeps refunds linked to the original installment", () => {
    expect(schema).toContain("refundOfId");
    expect(schema).toContain('refunds    Installment[] @relation("InstallmentRefund")');
  });

  it("creates all tables in a single additive migration", () => {
    for (const table of [
      '"clients"',
      '"contracts"',
      '"contract_items"',
      '"contract_projects"',
      '"installments"',
      '"contract_changes"',
      '"contract_audits"',
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-schema.test.ts
```

Expected: FAIL — the models, fields and migration file do not exist yet.

- [ ] **Step 3: Add the Profile and Project back-relations**

In `prisma/schema.prisma`, inside `model Profile`, after the existing
`pushSubscriptions PushSubscription[]` line, add:

```prisma
  ownedContracts        Contract[]        @relation("ContractOwner")
  contractChangeActors  ContractChange[]  @relation("ContractChangeActor")
  contractAudits        ContractAudit[]   @relation("ContractAuditActor")
```

Inside `model Project`, after the existing `documents Document[]` line, add:

```prisma
  contractProjects ContractProject[]
```

- [ ] **Step 4: Append the financial models to the schema**

Append to `prisma/schema.prisma`:

```prisma
model Client {
  id        String   @id @default(uuid())
  name      String
  legalName String?  @map("legal_name")
  cpfCnpj   String?  @map("cpf_cnpj")
  email     String?
  phone     String?
  notes     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  contracts Contract[]

  @@unique([cpfCnpj])
  @@index([active])
  @@map("clients")
}

model Contract {
  id               String   @id @default(uuid())
  code             String   @unique
  title            String
  clientId         String   @map("client_id")
  ownerId          String?  @map("owner_id")
  status           String   @default("draft")
  durationType     String   @map("duration_type")
  officialValue    Decimal  @map("official_value") @db.Decimal(14, 2)
  startDate        String   @map("start_date")
  endDate          String?  @map("end_date")
  billingFrequency String?  @map("billing_frequency")
  paymentMethod    String   @default("pix") @map("payment_method")
  documentUrl      String?  @map("document_url")
  notes            String?
  predecessorId    String?  @map("predecessor_id")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  client       Client           @relation(fields: [clientId], references: [id], onDelete: Restrict)
  owner        Profile?         @relation("ContractOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  items        ContractItem[]
  projects     ContractProject[]
  installments Installment[]
  changes      ContractChange[]
  audits       ContractAudit[]
  predecessor  Contract?        @relation("ContractRenewal", fields: [predecessorId], references: [id], onDelete: SetNull)
  successors   Contract[]       @relation("ContractRenewal")

  @@index([clientId])
  @@index([status])
  @@index([startDate])
  @@map("contracts")
}

model ContractItem {
  id          String   @id @default(uuid())
  contractId  String   @map("contract_id")
  name        String
  description String?
  quantity    Decimal? @db.Decimal(14, 4)
  unit        String?
  price       Decimal? @db.Decimal(14, 2)
  position    Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  contract Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@index([contractId])
  @@map("contract_items")
}

model ContractProject {
  contractId String @map("contract_id")
  projectId  String @map("project_id")

  contract Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@id([contractId, projectId])
  @@index([projectId])
  @@map("contract_projects")
}

model Installment {
  id             String   @id @default(uuid())
  contractId     String   @map("contract_id")
  expectedAmount Decimal  @map("expected_amount") @db.Decimal(14, 2)
  dueDate        String   @map("due_date")
  paymentMethod  String   @default("pix") @map("payment_method")
  status         String   @default("pending")
  paidAt         String?  @map("paid_at")
  refundOfId     String?  @map("refund_of_id")
  cycleKey       String?  @map("cycle_key")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  contract Contract     @relation(fields: [contractId], references: [id], onDelete: Cascade)
  refundOf Installment? @relation("InstallmentRefund", fields: [refundOfId], references: [id], onDelete: SetNull)
  refunds  Installment[] @relation("InstallmentRefund")

  @@unique([contractId, cycleKey])
  @@index([contractId, status])
  @@index([dueDate])
  @@index([refundOfId])
  @@map("installments")
}

model ContractChange {
  id            String   @id @default(uuid())
  contractId    String   @map("contract_id")
  type          String
  delta         Decimal  @db.Decimal(14, 2)
  effectiveDate String   @map("effective_date")
  description   String?
  previousValue Decimal  @map("previous_value") @db.Decimal(14, 2)
  newValue      Decimal  @map("new_value") @db.Decimal(14, 2)
  reason        String?
  actorId       String   @map("actor_id")
  createdAt     DateTime @default(now()) @map("created_at")

  contract Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  actor    Profile  @relation("ContractChangeActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@index([contractId, effectiveDate])
  @@map("contract_changes")
}

model ContractAudit {
  id          String   @id @default(uuid())
  contractId  String   @map("contract_id")
  actorId     String?  @map("actor_id")
  field       String
  beforeValue Json?   @map("before_value")
  afterValue  Json?   @map("after_value")
  reason      String?
  createdAt   DateTime @default(now()) @map("created_at")

  contract Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  actor    Profile? @relation("ContractAuditActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([contractId, createdAt])
  @@map("contract_audits")
}
```

- [ ] **Step 5: Create the additive migration SQL**

Create `prisma/migrations/20260802120000_financial_module/migration.sql`:

```sql
-- Financial module: clients, contracts, items, project links,
-- installments, changes and audits. All financial dates are TEXT YYYY-MM-DD
-- civil values; all money uses DECIMAL(14,2).

CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "cpf_cnpj" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_cpf_cnpj_key" ON "clients"("cpf_cnpj");
CREATE INDEX "clients_active_idx" ON "clients"("active");

CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration_type" TEXT NOT NULL,
    "official_value" DECIMAL(14,2) NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "billing_frequency" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'pix',
    "document_url" TEXT,
    "notes" TEXT,
    "predecessor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contracts_code_key" ON "contracts"("code");
CREATE INDEX "contracts_client_id_idx" ON "contracts"("client_id");
CREATE INDEX "contracts_status_idx" ON "contracts"("status");
CREATE INDEX "contracts_start_date_idx" ON "contracts"("start_date");

ALTER TABLE "contracts"
ADD CONSTRAINT "contracts_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contracts"
ADD CONSTRAINT "contracts_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contracts"
ADD CONSTRAINT "contracts_predecessor_id_fkey"
FOREIGN KEY ("predecessor_id") REFERENCES "contracts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contract_items" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,4),
    "unit" TEXT,
    "price" DECIMAL(14,2),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_items_contract_id_idx" ON "contract_items"("contract_id");

ALTER TABLE "contract_items"
ADD CONSTRAINT "contract_items_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "contract_projects" (
    "contract_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "contract_projects_pkey" PRIMARY KEY ("contract_id", "project_id")
);

CREATE INDEX "contract_projects_project_id_idx" ON "contract_projects"("project_id");

ALTER TABLE "contract_projects"
ADD CONSTRAINT "contract_projects_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_projects"
ADD CONSTRAINT "contract_projects_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "expected_amount" DECIMAL(14,2) NOT NULL,
    "due_date" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'pix',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TEXT,
    "refund_of_id" TEXT,
    "cycle_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "installments_contract_id_cycle_key_key"
ON "installments"("contract_id", "cycle_key");

CREATE INDEX "installments_contract_id_status_idx"
ON "installments"("contract_id", "status");

CREATE INDEX "installments_due_date_idx" ON "installments"("due_date");
CREATE INDEX "installments_refund_of_id_idx" ON "installments"("refund_of_id");

ALTER TABLE "installments"
ADD CONSTRAINT "installments_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "installments"
ADD CONSTRAINT "installments_refund_of_id_fkey"
FOREIGN KEY ("refund_of_id") REFERENCES "installments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contract_changes" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" DECIMAL(14,2) NOT NULL,
    "effective_date" TEXT NOT NULL,
    "description" TEXT,
    "previous_value" DECIMAL(14,2) NOT NULL,
    "new_value" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_changes_contract_id_effective_date_idx"
ON "contract_changes"("contract_id", "effective_date");

ALTER TABLE "contract_changes"
ADD CONSTRAINT "contract_changes_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_changes"
ADD CONSTRAINT "contract_changes_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "contract_audits" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "field" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_audits_contract_id_created_at_idx"
ON "contract_audits"("contract_id", "created_at");

ALTER TABLE "contract_audits"
ADD CONSTRAINT "contract_audits_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_audits"
ADD CONSTRAINT "contract_audits_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 6: Format, validate and run the schema test**

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx vitest run src/__tests__/financial-schema.test.ts
```

Expected: PASS. Apply the migration only if the local database is online:

```bash
npx prisma migrate deploy
```

If the database is offline, record that the migration was validated but not
applied and continue.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260802120000_financial_module/migration.sql src/__tests__/financial-schema.test.ts
git commit -m "feat(financial): add financial schema and migration"
```

---

### Task 2: Add Money and Civil Date Domain Helpers

**Files:**
- Create: `src/lib/financial/types.ts`
- Create: `src/lib/financial/money.ts`
- Create: `src/lib/financial/civil-date.ts`
- Create: `src/__tests__/financial-money.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toDecimal,
  add,
  sub,
  mul,
  div,
  sum,
  eq,
  lt,
  isNegative,
  toCents,
  fromCents,
  moneyToJson,
  formatBRL,
} from "../lib/financial/money";
import {
  isCivilDate,
  todayCivilDate,
  addMonthsCivil,
  addDaysCivil,
  monthKey,
  compareCivil,
  isWithin,
  formatCivilDate,
} from "../lib/financial/civil-date";

describe("money helpers", () => {
  it("performs decimal-safe arithmetic", () => {
    const a = toDecimal("10.10");
    const b = toDecimal("0.30");
    expect(add(a, b).toString()).toBe("10.4");
    expect(sub(a, b).toString()).toBe("9.8");
    expect(mul(a, toDecimal(2)).toString()).toBe("20.2");
    expect(div(a, toDecimal(2)).toString()).toBe("5.05");
    expect(sum([a, b, toDecimal("0.60")]).toString()).toBe("11");
  });

  it("never produces floating point error", () => {
    expect(add(toDecimal("0.1"), toDecimal("0.2")).toString()).toBe("0.3");
  });

  it("rounds to cents and formats BRL", () => {
    expect(toCents(toDecimal("12.34"))).toBe(1234);
    expect(fromCents(1234).toString()).toBe("12.34");
    expect(moneyToJson(toDecimal("12.3"))).toBe("12.30");
    expect(formatBRL(toDecimal("1234.5"))).toBe("R$ 1.234,50");
  });

  it("compares with tolerance-free decimal equality", () => {
    expect(eq(toDecimal("1.00"), toDecimal("1"))).toBe(true);
    expect(lt(toDecimal("0.99"), toDecimal("1"))).toBe(true);
    expect(isNegative(toDecimal("-0.01"))).toBe(true);
  });
});

describe("civil date helpers", () => {
  it("validates and compares YYYY-MM-DD strings", () => {
    expect(isCivilDate("2026-08-02")).toBe(true);
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2026-8-02")).toBe(false);
    expect(compareCivil("2026-08-02", "2026-08-03")).toBe(-1);
    expect(isWithin("2026-08-02", "2026-08-01", "2026-08-31")).toBe(true);
    expect(monthKey("2026-08-02")).toBe("2026-08");
  });

  it("adds months and days while clamping to month end", () => {
    expect(addMonthsCivil("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsCivil("2026-08-02", 2)).toBe("2026-10-02");
    expect(addDaysCivil("2026-08-02", 30)).toBe("2026-09-01");
  });

  it("produces a valid today value and UTC-stable formatting", () => {
    expect(isCivilDate(todayCivilDate())).toBe(true);
    expect(formatCivilDate("2026-08-02")).toBe("Aug 2, 2026");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-money.test.ts
```

Expected: FAIL — `../lib/financial/money` and `../lib/financial/civil-date`
do not exist.

- [ ] **Step 3: Create the shared types**

Create `src/lib/financial/types.ts`:

```ts
export const CONTRACT_STATUSES = ["draft", "active", "closed", "cancelled", "suspended"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DURATION_TYPES = ["fixed", "openEnded", "oneTime"] as const;
export type DurationType = (typeof DURATION_TYPES)[number];

export const BILLING_FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const PAYMENT_METHODS = ["pix", "boleto", "bank_transfer", "credit_card", "debit_card", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INSTALLMENT_STATUSES = ["pending", "paid", "cancelled"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const CHANGE_TYPES = ["upsell", "downsell"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type LifecycleAction = "activate" | "suspend" | "resume" | "close" | "cancel" | "renew";

export interface InstallmentPlanItem {
  expectedAmount: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
}

export interface ContractSummary {
  id: string;
  code: string;
  title: string;
  status: ContractStatus;
  durationType: DurationType;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  billingFrequency: BillingFrequency | null;
  clientId: string;
  ownerId: string | null;
  notes: string | null;
  paymentMethod: string;
  client: { id: string; name: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

- [ ] **Step 4: Create the money helpers**

Create `src/lib/financial/money.ts`:

```ts
import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;

export function toDecimal(value: string | number | Prisma.Decimal): Money {
  return new Prisma.Decimal(value);
}

export function add(a: Money, b: Money): Money {
  return a.plus(b);
}

export function sub(a: Money, b: Money): Money {
  return a.minus(b);
}

export function mul(a: Money, b: Money): Money {
  return a.times(b);
}

export function div(a: Money, b: Money): Money {
  return a.dividedBy(b);
}

export function neg(a: Money): Money {
  return a.negated();
}

export function sum(values: Money[]): Money {
  return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
}

export function eq(a: Money, b: Money): boolean {
  return a.equals(b);
}

export function gt(a: Money, b: Money): boolean {
  return a.greaterThan(b);
}

export function gte(a: Money, b: Money): boolean {
  return a.greaterThanOrEqualTo(b);
}

export function lt(a: Money, b: Money): boolean {
  return a.lessThan(b);
}

export function isNegative(a: Money): boolean {
  return a.isNegative();
}

export function toCents(a: Money): number {
  return a.times(100).toDecimalPlaces(0).toNumber();
}

export function fromCents(cents: number): Money {
  return new Prisma.Decimal(cents).dividedBy(100);
}

export function moneyToJson(a: Money): string {
  return a.toFixed(2);
}

export function formatBRL(value: Money): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value.toNumber());
}
```

- [ ] **Step 5: Create the civil date helpers**

Create `src/lib/financial/civil-date.ts`:

```ts
const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: string): boolean {
  if (!CIVIL_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayCivilDate(): string {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addMonthsCivil(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const result = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clampedDay)
  );
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addDaysCivil(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function diffMonths(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function compareCivil(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isWithin(date: string, from: string, to: string): boolean {
  return compareCivil(date, from) >= 0 && compareCivil(date, to) <= 0;
}

export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-money.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/types.ts src/lib/financial/money.ts src/lib/financial/civil-date.ts src/__tests__/financial-money.test.ts
git commit -m "feat(financial): add money and civil date helpers"
```

---

### Task 3: Add Contract Code and Installment Schedule Domain

**Files:**
- Create: `src/lib/financial/contract-code.ts`
- Create: `src/lib/financial/installments.ts`
- Create: `src/__tests__/financial-installments.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-installments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contractCode } from "../lib/financial/contract-code";
import {
  installmentCount,
  splitEqualInstallments,
  suggestFinitePlan,
  sumPlan,
  validateFinitePlan,
  recurringPlanForHorizon,
  suggestPlan,
} from "../lib/financial/installments";
import { toDecimal, eq, moneyToJson } from "../lib/financial/money";

describe("contract code", () => {
  it("formats CTR-YYYY-NNNN", () => {
    expect(contractCode(2026, 1)).toBe("CTR-2026-0001");
    expect(contractCode(2026, 9999)).toBe("CTR-2026-9999");
  });
});

describe("equal installment split", () => {
  it("splits evenly and puts the cent remainder in the final installment", () => {
    const parts = splitEqualInstallments(toDecimal("100.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("handles exact division", () => {
    const parts = splitEqualInstallments(toDecimal("99.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.00", "33.00", "33.00"]);
  });

  it("guards against a zero count", () => {
    expect(splitEqualInstallments(toDecimal("100"), 0)).toEqual([]);
  });
});

describe("finite plans", () => {
  it("counts monthly, quarterly, semiannual and annual periods", () => {
    expect(installmentCount("2026-01-01", "2026-12-01", "monthly")).toBe(12);
    expect(installmentCount("2026-01-01", "2026-12-01", "quarterly")).toBe(4);
    expect(installmentCount("2026-01-01", "2026-12-01", "semiannual")).toBe(2);
    expect(installmentCount("2026-01-01", "2026-12-01", "annual")).toBe(1);
  });

  it("suggests a plan whose total equals the official value", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    expect(plan).toHaveLength(12);
    expect(eq(sumPlan(plan), toDecimal("1200.00"))).toBe(true);
    expect(plan[0].dueDate).toBe("2026-01-01");
    expect(plan[0].paymentMethod).toBe("pix");
  });

  it("validates exact sums for finite contracts", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    plan[0] = { ...plan[0], expectedAmount: "100.00" };
    expect(validateFinitePlan(plan, toDecimal("1200.00"))).not.toHaveLength(0);
    expect(
      validateFinitePlan([], toDecimal("1200.00"))
    ).toContain("At least one installment is required");
  });
});

describe("recurring horizon", () => {
  it("builds a rolling window without duplicate cycle keys", () => {
    const plan = recurringPlanForHorizon(
      "2026-08-02",
      toDecimal("500.00"),
      0,
      3,
      "boleto"
    );
    expect(plan).toHaveLength(4);
    expect(plan[0].cycleKey).toBe("2026-08");
    expect(plan[1].cycleKey).toBe("2026-09");
    expect(plan[3].expectedAmount).toBe("500.00");
    expect(new Set(plan.map((p) => p.cycleKey)).size).toBe(4);
  });

  it("suggests a single installment for one-time contracts", () => {
    const plan = suggestPlan(
      toDecimal("3000.00"),
      "oneTime",
      "2026-08-02",
      null,
      null,
      "pix"
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].dueDate).toBe("2026-08-02");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-installments.test.ts
```

Expected: FAIL — the modules do not exist yet.

- [ ] **Step 3: Create the contract code helper**

Create `src/lib/financial/contract-code.ts`:

```ts
export function contractCode(year: number, sequence: number): string {
  return `CTR-${year}-${String(sequence).padStart(4, "0")}`;
}
```

- [ ] **Step 4: Create the installment schedule helpers**

Create `src/lib/financial/installments.ts`:

```ts
import type {
  BillingFrequency,
  DurationType,
  InstallmentPlanItem,
  PaymentMethod,
} from "./types";
import { addMonthsCivil, diffMonths } from "./civil-date";
import {
  Money,
  div,
  fromCents,
  moneyToJson,
  sub,
  sum,
  toCents,
  toDecimal,
  eq,
} from "./money";

export function monthStep(frequency: BillingFrequency): number {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  if (frequency === "semiannual") return 6;
  return 12;
}

export function installmentCount(
  startDate: string,
  endDate: string,
  frequency: BillingFrequency
): number {
  return Math.floor(diffMonths(startDate, endDate) / monthStep(frequency)) + 1;
}

export function splitEqualInstallments(total: Money, count: number): Money[] {
  if (count < 1) return [];
  const totalCents = toCents(total);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const amounts: Money[] = Array.from(
    { length: count },
    () => fromCents(baseCents)
  );
  if (remainder > 0) {
    amounts[count - 1] = fromCents(baseCents + remainder);
  }
  return amounts;
}

export function suggestFinitePlan(
  officialValue: Money,
  startDate: string,
  endDate: string,
  frequency: BillingFrequency,
  paymentMethod: PaymentMethod
): InstallmentPlanItem[] {
  const count = installmentCount(startDate, endDate, frequency);
  const amounts = splitEqualInstallments(officialValue, count);
  return amounts.map((amount, index) => ({
    expectedAmount: moneyToJson(amount),
    dueDate: addMonthsCivil(startDate, index * monthStep(frequency)),
    paymentMethod,
  }));
}

export function recurringCycleDueDate(startDate: string, index: number): string {
  return addMonthsCivil(startDate, index);
}

export function recurringCycleKey(startDate: string, index: number): string {
  return recurringCycleDueDate(startDate, index).slice(0, 7);
}

export function recurringPlanForHorizon(
  startDate: string,
  cycleValue: Money,
  startIndex: number,
  endIndex: number,
  paymentMethod: PaymentMethod
): Array<InstallmentPlanItem & { cycleKey: string }> {
  const items: Array<InstallmentPlanItem & { cycleKey: string }> = [];
  for (let index = startIndex; index <= endIndex; index++) {
    items.push({
      expectedAmount: moneyToJson(cycleValue),
      dueDate: recurringCycleDueDate(startDate, index),
      paymentMethod,
      cycleKey: recurringCycleKey(startDate, index),
    });
  }
  return items;
}

export function suggestPlan(
  officialValue: Money,
  durationType: DurationType,
  startDate: string,
  endDate: string | null,
  billingFrequency: BillingFrequency | null,
  paymentMethod: PaymentMethod
): InstallmentPlanItem[] {
  if (durationType === "oneTime") {
    return [{ expectedAmount: moneyToJson(officialValue), dueDate: startDate, paymentMethod }];
  }
  if (durationType === "openEnded") {
    return recurringPlanForHorizon(startDate, officialValue, 0, 11, paymentMethod);
  }
  const frequency = billingFrequency ?? "monthly";
  return suggestFinitePlan(
    officialValue,
    startDate,
    endDate ?? startDate,
    frequency,
    paymentMethod
  );
}

export function sumPlan(plan: InstallmentPlanItem[]): Money {
  return sum(plan.map((item) => toDecimal(item.expectedAmount)));
}

export function validateFinitePlan(
  plan: InstallmentPlanItem[],
  officialValue: Money
): string[] {
  const errors: string[] = [];
  if (plan.length === 0) errors.push("At least one installment is required");
  if (!eq(sumPlan(plan), officialValue)) {
    errors.push("Installment total must equal the official contract value");
  }
  return errors;
}

export function planTotal(plan: InstallmentPlanItem[]): Money {
  return sum(plan.map((item) => toDecimal(item.expectedAmount)));
}
```

Note: `planTotal` is used by the contract form to show the item-price and
installment consistency summary; `sub` is imported for `adjustmentPlanItem` in
Task 5 but is unused here — remove `sub` from this import list to keep
TypeScript strict (`noUnusedLocals`) clean.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-installments.test.ts
```

Expected: PASS. If `tsc --noEmit` later reports an unused import, drop it in
this file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/financial/contract-code.ts src/lib/financial/installments.ts src/__tests__/financial-installments.test.ts
git commit -m "feat(financial): add installment schedule domain"
```

---

### Task 4: Add Revenue Metrics Domain

**Files:**
- Create: `src/lib/financial/metrics.ts`
- Create: `src/__tests__/financial-metrics.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  monthlyValue,
  mrrForContract,
  arrForContract,
  forecastTotal,
  receivedTotal,
  overdueTotal,
  groupMonthly,
  isExpiringSoon,
  activeContractedValue,
  sumChangeDeltas,
} from "../lib/financial/metrics";
import { toDecimal, moneyToJson } from "../lib/financial/money";

const contract = (
  durationType: string,
  officialValue: string,
  startDate: string,
  endDate: string | null,
  billingFrequency: string | null
) => ({
  officialValue: toDecimal(officialValue),
  durationType,
  startDate,
  endDate,
  billingFrequency,
});

describe("MRR and ARR", () => {
  it("normalizes every recurring frequency", () => {
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "monthly"))).toBe("1200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "quarterly"))).toBe("400.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "semiannual"))).toBe("200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "annual"))).toBe("100.00");
  });

  it("computes MRR and ARR for open-ended recurring contracts", () => {
    const openEnded = contract("openEnded", "1200.00", "2026-08-02", null, "monthly");
    expect(moneyToJson(mrrForContract(openEnded)!) ).toBe("1200.00");
    expect(moneyToJson(arrForContract(openEnded)!)).toBe("14400.00");
  });

  it("computes fixed-term MRR from the term and returns null for one-time", () => {
    const fixed = contract("fixed", "12000.00", "2026-01-01", "2026-12-01", "monthly");
    expect(moneyToJson(mrrForContract(fixed)!)).toBe("1000.00");
    const oneTime = contract("oneTime", "5000.00", "2026-08-02", null, null);
    expect(mrrForContract(oneTime)).toBeNull();
  });
});

describe("forecast, received and overdue", () => {
  const installments = [
    { status: "pending", expectedAmount: toDecimal("1000"), dueDate: "2026-08-15", paidAt: null },
    { status: "paid", expectedAmount: toDecimal("500"), dueDate: "2026-08-01", paidAt: "2026-08-02" },
    { status: "cancelled", expectedAmount: toDecimal("700"), dueDate: "2026-09-01", paidAt: null },
    { status: "pending", expectedAmount: toDecimal("300"), dueDate: "2026-07-31", paidAt: null },
  ];

  it("groups non-cancelled forecast and received by month boundaries", () => {
    expect(moneyToJson(forecastTotal(installments, "2026-08-01", "2026-08-31"))).toBe("1500.00");
    expect(moneyToJson(receivedTotal(installments, "2026-08-01", "2026-08-31"))).toBe("500.00");
  });

  it("derives overdue from pending installments due before today", () => {
    expect(moneyToJson(overdueTotal(installments, "2026-08-02"))).toBe("300.00");
  });

  it("builds monthly chart points for the selected range", () => {
    const points = groupMonthly(installments, "2026-08-01", "2026-09-30");
    expect(points.map((p) => p.month)).toEqual(["2026-08", "2026-09"]);
    expect(moneyToJson(points[0].forecast)).toBe("1500.00");
    expect(moneyToJson(points[0].received)).toBe("500.00");
    expect(moneyToJson(points[1].forecast)).toBe("0.00");
  });
});

describe("contract metrics", () => {
  it("detects expiring contracts within the next 30 days", () => {
    expect(isExpiringSoon("2026-08-20", "2026-08-02")).toBe(true);
    expect(isExpiringSoon("2026-10-01", "2026-08-02")).toBe(false);
    expect(isExpiringSoon("2026-08-01", "2026-08-02")).toBe(false);
  });

  it("sums only active fixed and one-time official values", () => {
    const contracts = [
      { status: "active", durationType: "fixed", officialValue: toDecimal("1000") },
      { status: "active", durationType: "openEnded", officialValue: toDecimal("2000") },
      { status: "closed", durationType: "fixed", officialValue: toDecimal("3000") },
    ];
    expect(moneyToJson(activeContractedValue(contracts))).toBe("1000.00");
  });

  it("separates upsell and downsell sums by effective date", () => {
    const changes = [
      { type: "upsell", delta: toDecimal("500"), effectiveDate: "2026-08-10" },
      { type: "downsell", delta: toDecimal("200"), effectiveDate: "2026-08-15" },
      { type: "upsell", delta: toDecimal("100"), effectiveDate: "2026-09-01" },
    ];
    expect(moneyToJson(sumChangeDeltas(changes, "upsell", "2026-08-01", "2026-08-31"))).toBe("500.00");
    expect(moneyToJson(sumChangeDeltas(changes, "downsell", "2026-08-01", "2026-08-31"))).toBe("200.00");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-metrics.test.ts
```

Expected: FAIL — `src/lib/financial/metrics.ts` does not exist.

- [ ] **Step 3: Implement the metrics module**

Create `src/lib/financial/metrics.ts`:

```ts
import type {
  BillingFrequency,
  ChangeType,
} from "./types";
import { addDaysCivil, compareCivil, diffMonths, isWithin } from "./civil-date";
import { Money, div, mul, sum, toDecimal, moneyToJson } from "./money";

const FREQUENCY_MONTHS: Record<BillingFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function monthlyValue(
  officialValue: Money,
  frequency: BillingFrequency
): Money {
  return div(officialValue, toDecimal(FREQUENCY_MONTHS[frequency]));
}

interface ContractForMrr {
  officialValue: Money;
  durationType: string;
  billingFrequency: string | null;
  startDate: string;
  endDate: string | null;
}

export function mrrForContract(contract: ContractForMrr): Money | null {
  if (contract.durationType === "oneTime") return null;
  if (contract.durationType === "openEnded") {
    if (!contract.billingFrequency) return null;
    return monthlyValue(
      contract.officialValue,
      contract.billingFrequency as BillingFrequency
    );
  }
  if (!contract.endDate) return null;
  const months = Math.max(1, diffMonths(contract.startDate, contract.endDate));
  return div(contract.officialValue, toDecimal(months));
}

export function arrForContract(contract: ContractForMrr): Money | null {
  const mrr = mrrForContract(contract);
  return mrr ? mul(mrr, toDecimal(12)) : null;
}

export interface InstallmentLike {
  status: string;
  expectedAmount: Money;
  dueDate: string;
  paidAt: string | null;
}

export function forecastTotal(
  installments: InstallmentLike[],
  from: string,
  to: string
): Money {
  return sum(
    installments
      .filter((i) => i.status !== "cancelled" && isWithin(i.dueDate, from, to))
      .map((i) => i.expectedAmount)
  );
}

export function receivedTotal(
  installments: InstallmentLike[],
  from: string,
  to: string
): Money {
  return sum(
    installments
      .filter(
        (i) =>
          i.status === "paid" &&
          i.paidAt !== null &&
          isWithin(i.paidAt, from, to)
      )
      .map((i) => i.expectedAmount)
  );
}

export function overdueTotal(
  installments: InstallmentLike[],
  today: string
): Money {
  return sum(
    installments
      .filter((i) => i.status === "pending" && compareCivil(i.dueDate, today) < 0)
      .map((i) => i.expectedAmount)
  );
}

export interface MonthlyPoint {
  month: string;
  forecast: string;
  received: string;
}

export function groupMonthly(
  installments: InstallmentLike[],
  from: string,
  to: string
): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const endKey = to.slice(0, 7);
  let guard = 0;
  while (cursor.slice(0, 7) <= endKey && guard < 60) {
    const next = `${addDaysCivil(cursor, 32).slice(0, 7)}-01`;
    const end = addDaysCivil(next, -1);
    points.push({
      month: cursor.slice(0, 7),
      forecast: moneyToJson(forecastTotal(installments, cursor, end)),
      received: moneyToJson(receivedTotal(installments, cursor, end)),
    });
    cursor = next;
    guard += 1;
  }
  return points;
}

export function isExpiringSoon(
  endDate: string,
  today: string,
  days = 30
): boolean {
  const horizon = addDaysCivil(today, days);
  return compareCivil(endDate, today) >= 0 && compareCivil(endDate, horizon) <= 0;
}

export function activeContractedValue(
  contracts: Array<{
    status: string;
    durationType: string;
    officialValue: Money;
  }>
): Money {
  return sum(
    contracts
      .filter(
        (c) =>
          c.status === "active" &&
          (c.durationType === "fixed" || c.durationType === "oneTime")
      )
      .map((c) => c.officialValue)
  );
}

export function sumChangeDeltas(
  changes: Array<{
    type: string;
    delta: Money;
    effectiveDate: string;
  }>,
  type: ChangeType,
  from: string,
  to: string
): Money {
  return sum(
    changes
      .filter((c) => c.type === type && isWithin(c.effectiveDate, from, to))
      .map((c) => c.delta)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial/metrics.ts src/__tests__/financial-metrics.test.ts
git commit -m "feat(financial): add revenue metrics domain"
```

---

### Task 5: Add Lifecycle and Upsell/Downsell Rules

**Files:**
- Create: `src/lib/financial/lifecycle.ts`
- Create: `src/lib/financial/changes.ts`
- Create: `src/lib/financial/audit.ts`
- Create: `src/__tests__/financial-lifecycle.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FinancialConflictError,
  activationErrors,
  transition,
  cancellationPlan,
  renewablePredecessor,
} from "../lib/financial/lifecycle";
import {
  redistributeDelta,
  validateDownsell,
  validateRedistributedPlan,
  adjustmentPlanItem,
} from "../lib/financial/changes";
import { toDecimal, moneyToJson, isNegative } from "../lib/financial/money";

const draftContract = {
  clientId: "client-1",
  title: "Engagement",
  durationType: "fixed",
  officialValue: toDecimal("1200.00"),
  startDate: "2026-01-01",
  endDate: "2026-12-01",
  billingFrequency: "monthly",
  status: "draft",
} as const;

describe("transitions", () => {
  it("applies the documented lifecycle", () => {
    expect(transition("draft", "activate")).toBe("active");
    expect(transition("active", "suspend")).toBe("suspended");
    expect(transition("suspended", "resume")).toBe("active");
    expect(transition("active", "close")).toBe("closed");
    expect(transition("active", "cancel")).toBe("cancelled");
  });

  it("rejects invalid transitions with a conflict error", () => {
    expect(() => transition("closed", "activate")).toThrow(FinancialConflictError);
    expect(() => transition("cancelled", "resume")).toThrow(FinancialConflictError);
  });
});

describe("activation rules", () => {
  it("accepts a complete fixed contract with a matching plan", () => {
    const plan = [
      { expectedAmount: "100.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
      { expectedAmount: "100.00", dueDate: "2026-02-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors({ ...draftContract, officialValue: toDecimal("200.00") }, plan);
    expect(errors).toEqual([]);
  });

  it("rejects missing fields and inconsistent dates", () => {
    const errors = activationErrors(
      { ...draftContract, clientId: "", endDate: "2025-01-01" },
      [{ expectedAmount: "1200.00", dueDate: "2026-01-01", paymentMethod: "pix" }]
    );
    expect(errors).toContain("A client is required");
    expect(errors).toContain("End date must not precede the start date");
  });
});

describe("cancellation plan", () => {
  it("cancels only future pending installments while keeping retained ones", () => {
    const installments = [
      { id: "a", status: "pending" as const, dueDate: "2026-08-15" },
      { id: "b", status: "pending" as const, dueDate: "2026-08-05" },
      { id: "c", status: "pending" as const, dueDate: "2026-09-01" },
      { id: "d", status: "paid" as const, dueDate: "2026-10-01" },
    ];
    expect(
      cancellationPlan(installments, "2026-08-10", ["c"])
    ).toEqual(["a"]);
  });
});

describe("renewal", () => {
  it("accepts active and suspended predecessors", () => {
    expect(renewablePredecessor("active")).toBe(true);
    expect(renewablePredecessor("suspended")).toBe(true);
    expect(renewablePredecessor("closed")).toBe(false);
    expect(renewablePredecessor("cancelled")).toBe(false);
  });
});

describe("upsell and downsell", () => {
  const pending = [
    { id: "1", expectedAmount: toDecimal("100.00") },
    { id: "2", expectedAmount: toDecimal("100.00") },
    { id: "3", expectedAmount: toDecimal("100.00") },
  ];

  it("redistributes an upsell delta across pending installments", () => {
    const adjusted = redistributeDelta(pending, toDecimal("30.00"), "upsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "110.00",
      "110.00",
      "110.00",
    ]);
  });

  it("redistributes a downsell delta proportionally", () => {
    const adjusted = redistributeDelta(pending, toDecimal("3.00"), "downsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "99.00",
      "99.00",
      "99.00",
    ]);
  });

  it("rejects invalid downsells and negative redistributions", () => {
    expect(validateDownsell(toDecimal("100.00"), toDecimal("150.00"))).toContain(
      "Downsell cannot make the contract value negative"
    );
    const plan = [
      { expectedAmount: toDecimal("0.50") },
      { expectedAmount: toDecimal("0.50") },
    ];
    const bad = redistributeDelta(plan, toDecimal("3.00"), "downsell");
    expect(validateRedistributedPlan(bad)).not.toHaveLength(0);
    expect(bad.some((b) => isNegative(b.expectedAmount))).toBe(true);
  });

  it("builds a negative adjustment item for downsell", () => {
    const item = adjustmentPlanItem(
      "downsell",
      toDecimal("200.00"),
      "2026-08-15",
      "pix"
    );
    expect(moneyToJson(toDecimal(item.expectedAmount))).toBe("-200.00");
    expect(item.dueDate).toBe("2026-08-15");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-lifecycle.test.ts
```

Expected: FAIL — the three modules do not exist yet.

- [ ] **Step 3: Implement the lifecycle rules**

Create `src/lib/financial/lifecycle.ts`:

```ts
import type {
  ContractStatus,
  InstallmentPlanItem,
  LifecycleAction,
} from "./types";
import { compareCivil } from "./civil-date";
import { Money, eq } from "./money";
import { validateFinitePlan, sumPlan } from "./installments";

export class FinancialConflictError extends Error {}

export class FinancialValidationError extends Error {}

const TRANSITIONS: Record<ContractStatus, Partial<Record<LifecycleAction, ContractStatus>>> = {
  draft: { activate: "active", cancel: "cancelled" },
  active: { suspend: "suspended", close: "closed", cancel: "cancelled" },
  suspended: { resume: "active", close: "closed", cancel: "cancelled" },
  closed: {},
  cancelled: {},
};

export function transition(
  current: string,
  action: LifecycleAction
): ContractStatus {
  const next = TRANSITIONS[current as ContractStatus]?.[action];
  if (!next) {
    throw new FinancialConflictError(
      `Cannot ${action} a contract in status ${current}`
    );
  }
  return next;
}

export function renewablePredecessor(status: string): boolean {
  return status === "active" || status === "suspended";
}

interface ContractForActivation {
  clientId: string;
  title: string;
  durationType: string;
  officialValue: Money;
  startDate: string;
  endDate: string | null;
  billingFrequency: string | null;
}

export function activationErrors(
  contract: ContractForActivation,
  plan: InstallmentPlanItem[]
): string[] {
  const errors: string[] = [];
  if (!contract.clientId) errors.push("A client is required");
  if (!contract.title.trim()) errors.push("A title is required");
  if (!contract.startDate) errors.push("A start date is required");
  if (contract.endDate && compareCivil(contract.endDate, contract.startDate) < 0) {
    errors.push("End date must not precede the start date");
  }
  if (
    contract.durationType === "openEnded" &&
    !contract.billingFrequency
  ) {
    errors.push("A billing frequency is required for recurring contracts");
  }
  if (contract.durationType !== "openEnded") {
    errors.push(...validateFinitePlan(plan, contract.officialValue));
  } else if (!eq(sumPlan(plan), contract.officialValue)) {
    errors.push("Installment total must equal the official contract value");
  }
  return errors;
}

export function cancellationPlan(
  installments: Array<{
    id: string;
    status: string;
    dueDate: string;
  }>,
  effectiveDate: string,
  retainedIds: string[]
): string[] {
  return installments
    .filter((i) => i.status === "pending")
    .filter((i) => !retainedIds.includes(i.id))
    .filter((i) => compareCivil(i.dueDate, effectiveDate) > 0)
    .map((i) => i.id);
}
```

- [ ] **Step 4: Implement the upsell/downsell rules**

Create `src/lib/financial/changes.ts`:

```ts
import type { ChangeType, InstallmentPlanItem, PaymentMethod } from "./types";
import { isNegative, lt, Money, neg, sub, sum, toCents, toDecimal, fromCents, gt, moneyToJson } from "./money";

export interface PendingInstallment {
  id: string;
  expectedAmount: Money;
}

export function redistributeDelta(
  pending: PendingInstallment[],
  delta: Money,
  type: ChangeType
): PendingInstallment[] {
  if (pending.length === 0) return [];
  const sign = type === "upsell" ? 1 : -1;
  const totalPending = sum(pending.map((p) => p.expectedAmount));
  const totalCents = toCents(totalPending);
  if (totalCents === 0) {
    return pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount }));
  }
  const deltaCents = toCents(delta);
  const shares = pending.map((p) =>
    Math.floor((toCents(p.expectedAmount) / totalCents) * deltaCents)
  );
  let remaining = deltaCents - shares.reduce((acc, s) => acc + s, 0);
  for (let i = 0; i < shares.length && remaining > 0; i++) {
    shares[i] += 1;
    remaining -= 1;
  }
  return pending.map((p, i) => ({
    id: p.id,
    expectedAmount: fromCents(
      toCents(p.expectedAmount) + sign * shares[i]
    ),
  }));
}

export function validateRedistributedPlan(
  plan: PendingInstallment[]
): string[] {
  return plan
    .filter((p) => isNegative(p.expectedAmount))
    .map(() => "Redistribution would create a negative installment");
}

export function validateDownsell(officialValue: Money, delta: Money): string[] {
  const errors: string[] = [];
  if (!gt(delta, toDecimal(0))) errors.push("Delta must be greater than zero");
  if (lt(officialValue, delta)) {
    errors.push("Downsell cannot make the contract value negative");
  }
  return errors;
}

export function adjustmentPlanItem(
  type: ChangeType,
  delta: Money,
  effectiveDate: string,
  paymentMethod: PaymentMethod
): InstallmentPlanItem {
  return {
    expectedAmount: moneyToJson(type === "downsell" ? neg(delta) : delta),
    dueDate: effectiveDate,
    paymentMethod,
  };
}
```

Note: `sub` is imported but unused in this file — remove it from the import
list before committing so `tsc --noEmit` stays clean.

- [ ] **Step 5: Implement the audit recorder**

Create `src/lib/financial/audit.ts`:

```ts
import type { Prisma } from "@prisma/client";

export interface FinancialAuditInput {
  contractId: string;
  actorId: string | null;
  field: string;
  beforeValue?: Prisma.InputJsonValue;
  afterValue?: Prisma.InputJsonValue;
  reason?: string | null;
}

export async function recordFinancialAudit(
  tx: Prisma.TransactionClient,
  input: FinancialAuditInput
): Promise<void> {
  await tx.contractAudit.create({
    data: {
      contractId: input.contractId,
      actorId: input.actorId,
      field: input.field,
      ...(input.beforeValue !== undefined
        ? { beforeValue: input.beforeValue }
        : {}),
      ...(input.afterValue !== undefined
        ? { afterValue: input.afterValue }
        : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
}
```

> Consistency note: callers must pass `Prisma.InputJsonValue`-compatible values
> (strings, numbers, booleans, JSON objects/arrays). Use the `afterValue`
> field for single-sided entries and omit `beforeValue` instead of passing
> `null`.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/lifecycle.ts src/lib/financial/changes.ts src/lib/financial/audit.ts src/__tests__/financial-lifecycle.test.ts
git commit -m "feat(financial): add lifecycle and change rules"
```

---

### Task 6: Add Transactional Financial Services

**Files:**
- Create: `src/lib/financial/contracts-service.ts`
- Create: `src/lib/financial/installments-service.ts`
- Create: `src/lib/financial/overview-service.ts`
- Create: `src/__tests__/financial-services.test.ts`

- [ ] **Step 1: Write the failing service contract test**

Create `src/__tests__/financial-services.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial transactional services", () => {
  it("wraps activation in a transaction and validates the plan", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("prisma.$transaction");
    expect(source).toContain("activationErrors");
    expect(source).toContain("recordFinancialAudit");
    expect(source).toContain("createMany");
  });

  it("guards project conflicts and renewal predecessors", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("already belongs to another active contract");
    expect(source).toContain("renewablePredecessor");
    expect(source).toContain("contractProject.deleteMany");
  });

  it("generates the next sequential contract code per year", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("nextContractCode");
    expect(source).toContain("contractCode(");
  });

  it("protects paid installments and enforces refund limits", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain("refundableValue");
    expect(source).toContain("status !== \"paid\"");
    expect(source).toContain("neg(");
  });

  it("extends recurring horizons idempotently by cycle key", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain("extendRecurringHorizons");
    expect(source).toContain("cycleKey");
    expect(source).toContain("addMonthsCivil(today, 12)");
  });

  it("aggregates overview metrics on the server", () => {
    const source = read("src/lib/financial/overview-service.ts");
    expect(source).toContain("extendRecurringHorizons");
    expect(source).toContain("activeContractedValue");
    expect(source).toContain("groupMonthly");
    expect(source).toContain("mrrForContract");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-services.test.ts
```

Expected: FAIL — the three service files do not exist.

- [ ] **Step 3: Implement the contracts service**

Create `src/lib/financial/contracts-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { contractCode } from "./contract-code";
import {
  FinancialConflictError,
  FinancialValidationError,
  activationErrors,
  cancellationPlan,
  renewablePredecessor,
  transition,
} from "./lifecycle";
import { recordFinancialAudit } from "./audit";
import {
  adjustmentPlanItem,
  redistributeDelta,
  validateDownsell,
  validateRedistributedPlan,
} from "./changes";
import { add, neg, sub, toDecimal } from "./money";
import type {
  ChangeType,
  InstallmentPlanItem,
  LifecycleAction,
  PaymentMethod,
} from "./types";

export async function nextContractCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `CTR-${year}-`;
  const last = await tx.contract.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const sequence = last ? parseInt(last.code.slice(-4), 10) + 1 : 1;
  return contractCode(year, sequence);
}

export interface ContractDraftInput {
  title: string;
  clientId: string;
  ownerId?: string | null;
  durationType: string;
  officialValue: string;
  startDate: string;
  endDate?: string | null;
  billingFrequency?: string | null;
  paymentMethod: PaymentMethod;
  documentUrl?: string | null;
  notes?: string | null;
  items?: Array<{
    name: string;
    description?: string | null;
    quantity?: string | null;
    unit?: string | null;
    price?: string | null;
    position: number;
  }>;
  projectIds?: string[];
}

export async function createContractDraft(
  input: ContractDraftInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const code = await nextContractCode(tx);
    return tx.contract.create({
      data: {
        code,
        title: input.title,
        clientId: input.clientId,
        ownerId: input.ownerId ?? null,
        status: "draft",
        durationType: input.durationType,
        officialValue: toDecimal(input.officialValue),
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        billingFrequency: input.billingFrequency ?? null,
        paymentMethod: input.paymentMethod,
        documentUrl: input.documentUrl ?? null,
        notes: input.notes ?? null,
        items: input.items?.length
          ? {
              create: input.items.map((item) => ({
                name: item.name,
                description: item.description ?? null,
                quantity: item.quantity ? toDecimal(item.quantity) : null,
                unit: item.unit ?? null,
                price: item.price ? toDecimal(item.price) : null,
                position: item.position,
              })),
            }
          : undefined,
        projects: input.projectIds?.length
          ? { create: input.projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
      include: { client: true, items: true, projects: true },
    });
  });
}

export interface ContractUpdateInput {
  title?: string;
  clientId?: string;
  ownerId?: string | null;
  durationType?: string;
  officialValue?: string;
  startDate?: string;
  endDate?: string | null;
  billingFrequency?: string | null;
  paymentMethod?: PaymentMethod;
  documentUrl?: string | null;
  notes?: string | null;
  status?: string;
}

export async function updateContract(
  contractId: string,
  input: ContractUpdateInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft" && contract.status !== "active") {
      throw new FinancialConflictError(
        "Only draft and active contracts can be edited"
      );
    }
    const financialFields: Array<keyof ContractUpdateInput> = [
      "officialValue",
      "startDate",
      "endDate",
      "billingFrequency",
      "durationType",
    ];
    for (const field of financialFields) {
      const next = input[field];
      if (next !== undefined) {
        await recordFinancialAudit(tx, {
          contractId,
          actorId,
          field,
          beforeValue: String(
            (contract as Record<string, unknown>)[field]
          ),
          afterValue: String(next),
        });
      }
    }
    const data: Prisma.ContractUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.clientId !== undefined) data.client = { connect: { id: input.clientId } };
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId
        ? { connect: { id: input.ownerId } }
        : { disconnect: true };
    }
    if (input.durationType !== undefined) data.durationType = input.durationType;
    if (input.officialValue !== undefined) data.officialValue = toDecimal(input.officialValue);
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.billingFrequency !== undefined) data.billingFrequency = input.billingFrequency;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.documentUrl !== undefined) data.documentUrl = input.documentUrl;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) data.status = input.status;
    return tx.contract.update({
      where: { id: contractId },
      data,
      include: { client: true, items: true, projects: true },
    });
  });
}

export async function deleteDraftContract(contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft") {
      throw new FinancialConflictError(
        "Only draft contracts can be deleted"
      );
    }
    await tx.contract.delete({ where: { id: contractId } });
  });
}

export async function activateContract(
  contractId: string,
  plan: InstallmentPlanItem[],
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { projects: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");

    const errors = activationErrors(contract, plan);
    if (errors.length > 0) {
      throw new FinancialValidationError(errors.join("; "));
    }

    for (const link of contract.projects) {
      const conflict = await tx.contractProject.findFirst({
        where: {
          projectId: link.projectId,
          contract: { status: "active", id: { not: contractId } },
        },
        select: { contractId: true },
      });
      if (conflict) {
        throw new FinancialConflictError(
          "A linked project already belongs to another active contract"
        );
      }
    }

    const predecessor = contract.predecessorId
      ? await tx.contract.findUnique({
          where: { id: contract.predecessorId },
          select: { status: true },
        })
      : null;
    if (
      contract.predecessorId &&
      predecessor &&
      !renewablePredecessor(predecessor.status)
    ) {
      throw new FinancialConflictError(
        "Predecessor is not in a renewable state"
      );
    }

    await tx.installment.createMany({
      data: plan.map((item) => ({
        contractId,
        expectedAmount: toDecimal(item.expectedAmount),
        dueDate: item.dueDate,
        paymentMethod: item.paymentMethod,
        status: "pending",
        cycleKey:
          contract.durationType === "openEnded"
            ? item.dueDate.slice(0, 7)
            : null,
      })),
    });

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: "active" },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "status",
      beforeValue: "draft",
      afterValue: "active",
    });

    if (contract.predecessorId) {
      await tx.contractProject.deleteMany({
        where: { contractId: contract.predecessorId },
      });
      await tx.contract.update({
        where: { id: contract.predecessorId },
        data: { status: "closed" },
      });
    }

    return updated;
  });
}

export interface LifecyclePayload {
  effectiveDate?: string;
  retainedInstallmentIds?: string[];
}

export async function applyLifecycleAction(
  contractId: string,
  action: Exclude<LifecycleAction, "renew"> | "renew",
  payload: LifecyclePayload,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { items: true, projects: true, installments: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");

    if (action === "renew") {
      if (!renewablePredecessor(contract.status)) {
        throw new FinancialConflictError(
          "Only active or suspended contracts can be renewed"
        );
      }
      const code = await nextContractCode(tx);
      const renewal = await tx.contract.create({
        data: {
          code,
          title: contract.title,
          clientId: contract.clientId,
          ownerId: contract.ownerId,
          status: "draft",
          durationType: contract.durationType,
          officialValue: contract.officialValue,
          startDate: contract.startDate,
          endDate: contract.endDate,
          billingFrequency: contract.billingFrequency,
          paymentMethod: contract.paymentMethod as PaymentMethod,
          documentUrl: contract.documentUrl,
          notes: contract.notes,
          predecessorId: contract.id,
          items: {
            create: contract.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              position: item.position,
            })),
          },
          projects: {
            create: contract.projects.map((project) => ({
              projectId: project.projectId,
            })),
          },
        },
      });
      await recordFinancialAudit(tx, {
        contractId,
        actorId,
        field: "renewal",
        afterValue: renewal.id,
      });
      return renewal;
    }

    if (action === "cancel") {
      if (!payload.effectiveDate) {
        throw new FinancialValidationError(
          "An effective date is required to cancel a contract"
        );
      }
      const cancelledIds = cancellationPlan(
        contract.installments,
        payload.effectiveDate,
        payload.retainedInstallmentIds ?? []
      );
      if (cancelledIds.length > 0) {
        await tx.installment.updateMany({
          where: { id: { in: cancelledIds } },
          data: { status: "cancelled" },
        });
      }
    }

    const status = transition(contract.status, action);
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "status",
      beforeValue: contract.status,
      afterValue: status,
      reason:
        action === "cancel" ? `Cancelled effective ${payload.effectiveDate}` : undefined,
    });

    return updated;
  });
}

export interface ContractChangeInput {
  type: ChangeType;
  delta: string;
  effectiveDate: string;
  description?: string;
  reason?: string;
  strategy: "redistribute" | "adjust";
  confirm?: boolean;
}

export async function applyContractChange(
  contractId: string,
  input: ContractChangeInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "active") {
      throw new FinancialConflictError("Only active contracts can be adjusted");
    }

    const delta = toDecimal(input.delta);
    const deltaErrors = validateDownsell(contract.officialValue, delta);
    if (deltaErrors.length > 0) {
      throw new FinancialValidationError(deltaErrors.join("; "));
    }

    const pending = contract.installments.filter((i) => i.status === "pending");

    if (!input.confirm) {
      const proposal =
        input.strategy === "redistribute"
          ? {
              strategy: "redistribute",
              installments: redistributeDelta(
                pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount })),
                delta,
                input.type
              ),
            }
          : {
              strategy: "adjust",
              installments: [
                adjustmentPlanItem(
                  input.type,
                  delta,
                  input.effectiveDate,
                  contract.paymentMethod as PaymentMethod
                ),
              ],
            };
      return { applied: false, proposal };
    }

    if (input.strategy === "redistribute") {
      const adjusted = redistributeDelta(
        pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount })),
        delta,
        input.type
      );
      const invalid = validateRedistributedPlan(adjusted);
      if (invalid.length > 0) {
        throw new FinancialValidationError(invalid.join("; "));
      }
      for (const item of adjusted) {
        await tx.installment.update({
          where: { id: item.id },
          data: { expectedAmount: item.expectedAmount },
        });
      }
    } else {
      await tx.installment.create({
        data: {
          contractId,
          expectedAmount:
            input.type === "downsell" ? neg(delta) : delta,
          dueDate: input.effectiveDate,
          paymentMethod: contract.paymentMethod,
          status: "pending",
          cycleKey: null,
        },
      });
    }

    const previousValue = contract.officialValue;
    const newValue =
      input.type === "upsell"
        ? add(previousValue, delta)
        : sub(previousValue, delta);

    await tx.contract.update({
      where: { id: contractId },
      data: { officialValue: newValue },
    });

    await tx.contractChange.create({
      data: {
        contractId,
        type: input.type,
        delta,
        effectiveDate: input.effectiveDate,
        description: input.description ?? null,
        previousValue,
        newValue,
        reason: input.reason ?? null,
        actorId,
      },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "officialValue",
      beforeValue: previousValue.toFixed(2),
      afterValue: newValue.toFixed(2),
      reason: input.reason,
    });

    return {
      applied: true,
      contract: await tx.contract.findUnique({ where: { id: contractId } }),
    };
  });
}
```

- [ ] **Step 4: Implement the installments service**

Create `src/lib/financial/installments-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { FinancialConflictError, FinancialValidationError } from "./lifecycle";
import { add, lt, neg, sub, sum, toDecimal } from "./money";

export function refundableValue(
  installment: { expectedAmount: Prisma.Decimal },
  refunds: Array<{ expectedAmount: Prisma.Decimal }>
): Prisma.Decimal {
  const refunded = sum(refunds.map((r) => r.expectedAmount));
  return sub(installment.expectedAmount, refunded.negated());
}

export async function recordPayment(
  installmentId: string,
  paidAt: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be marked as paid"
      );
    }
    return tx.installment.update({
      where: { id: installmentId },
      data: { status: "paid", paidAt },
    });
  });
}

export async function cancelInstallment(
  installmentId: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be cancelled"
      );
    }
    return tx.installment.update({
      where: { id: installmentId },
      data: { status: "cancelled" },
    });
  });
}

export async function refundInstallment(
  installmentId: string,
  refundAmount: string,
  refundDate: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
      include: { refunds: { select: { expectedAmount: true } } },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "paid") {
      throw new FinancialConflictError(
        "Refunds must link to a paid installment"
      );
    }
    const requested = toDecimal(refundAmount);
    const refundable = refundableValue(installment, installment.refunds);
    if (lt(requested, toDecimal(0))) {
      throw new FinancialValidationError("Refund amount must be positive");
    }
    if (lt(refundable, requested)) {
      throw new FinancialValidationError(
        "Refund exceeds the refundable value of the installment"
      );
    }
    return tx.installment.create({
      data: {
        contractId: installment.contractId,
        expectedAmount: neg(requested),
        dueDate: installment.dueDate,
        paymentMethod: installment.paymentMethod,
        status: "paid",
        paidAt: refundDate,
        refundOfId: installmentId,
        cycleKey: null,
      },
    });
  });
}

export async function extendRecurringHorizons(
  tx: Prisma.TransactionClient
): Promise<number> {
  const today = todayCivilDate();
  const targetDate = addMonthsCivil(today, 12);
  const contracts = await tx.contract.findMany({
    where: { status: "active", durationType: "openEnded" },
    select: {
      id: true,
      startDate: true,
      officialValue: true,
      paymentMethod: true,
      billingFrequency: true,
    },
  });
  let created = 0;
  for (const contract of contracts) {
    const existing = await tx.installment.findMany({
      where: { contractId: contract.id },
      select: { cycleKey: true },
    });
    const existingKeys = new Set(
      existing.map((i) => i.cycleKey).filter((k): k is string => Boolean(k))
    );
    const step = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
      (contract.billingFrequency ?? "monthly") as "monthly" | "quarterly" | "semiannual" | "annual"
    ];
    let index = 0;
    while (true) {
      const dueDate = addMonthsCivil(contract.startDate, index * step);
      if (compareCivil(dueDate, targetDate) > 0) break;
      if (compareCivil(dueDate, today) >= 0) {
        const cycleKey = dueDate.slice(0, 7);
        if (!existingKeys.has(cycleKey)) {
          await tx.installment.create({
            data: {
              contractId: contract.id,
              expectedAmount: contract.officialValue,
              dueDate,
              paymentMethod: contract.paymentMethod,
              status: "pending",
              cycleKey,
            },
          });
          created += 1;
        }
      }
      index += 1;
    }
  }
  return created;
}
```

Note: `add` is imported but unused in this file — remove it from the import
list before committing so `tsc --noEmit` stays clean.

- [ ] **Step 5: Implement the overview service**

Create `src/lib/financial/overview-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import {
  activeContractedValue,
  arrForContract,
  forecastTotal,
  groupMonthly,
  isExpiringSoon,
  mrrForContract,
  overdueTotal,
  receivedTotal,
  sumChangeDeltas,
} from "./metrics";
import { extendRecurringHorizons } from "./installments-service";
import { addDaysCivil, addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { moneyToJson, sum, toDecimal } from "./money";
import type { BillingFrequency, ContractStatus, InstallmentStatus } from "./types";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: ContractStatus;
  projectId?: string;
  installmentStatus?: InstallmentStatus;
}

export interface OverviewData {
  kpis: {
    activeContractedValue: string;
    mrr: string;
    arr: string;
    cashForecast: string;
    received: string;
    overdue: string;
    upsell: string;
    downsell: string;
    activeContracts: number;
    expiringSoon: number;
  };
  monthly: Array<{ month: string; forecast: string; received: string }>;
  overdueInstallments: Array<{
    id: string;
    contractCode: string;
    contractTitle: string;
    clientName: string;
    expectedAmount: string;
    dueDate: string;
  }>;
  expiringContracts: Array<{
    id: string;
    code: string;
    title: string;
    clientName: string;
    status: string;
    endDate: string;
    officialValue: string;
  }>;
}

export async function computeOverview(
  filters: OverviewFilters
): Promise<OverviewData> {
  const today = todayCivilDate();
  const from =
    filters.period === "custom"
      ? filters.from ?? today
      : filters.period === "currentMonth"
        ? `${today.slice(0, 7)}-01`
        : today;
  const to =
    filters.period === "custom"
      ? filters.to ?? addDaysCivil(today, 90)
      : filters.period === "currentMonth"
        ? addDaysCivil(addMonthsCivil(from, 1), -1)
        : addDaysCivil(today, 90);

  return prisma.$transaction(async (tx) => {
    await extendRecurringHorizons(tx);

    const contractWhere: Prisma.ContractWhereInput = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.contractStatus ? { status: filters.contractStatus } : {}),
      ...(filters.projectId ? { projects: { some: { projectId: filters.projectId } } } : {}),
    };

    const contracts = await tx.contract.findMany({
      where: contractWhere,
      include: { client: true },
    });
    const installments = await tx.installment.findMany({
      where: {
        contract: contractWhere,
        ...(filters.installmentStatus ? { status: filters.installmentStatus } : {}),
      },
    });
    const changes = await tx.contractChange.findMany({
      where: { contract: contractWhere },
    });

    const active = contracts.filter((c) => c.status === "active");
    const mrr = sum(
      active.map((c) =>
        mrrForContract({
          officialValue: c.officialValue,
          durationType: c.durationType,
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate,
          endDate: c.endDate,
        }) ?? toDecimal(0)
      )
    );
    const arr = sum(
      active.map((c) =>
        arrForContract({
          officialValue: c.officialValue,
          durationType: c.durationType,
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate,
          endDate: c.endDate,
        }) ?? toDecimal(0)
      )
    );

    const overdueInstallments = installments
      .filter((i) => i.status === "pending" && compareCivil(i.dueDate, today) < 0)
      .sort((a, b) => compareCivil(a.dueDate, b.dueDate))
      .slice(0, 10)
      .map((i) => {
        const contract = contracts.find((c) => c.id === i.contractId);
        return {
          id: i.id,
          contractCode: contract?.code ?? "",
          contractTitle: contract?.title ?? "",
          clientName: contract?.client.name ?? "",
          expectedAmount: moneyToJson(i.expectedAmount),
          dueDate: i.dueDate,
        };
      });

    const expiringContracts = active
      .filter(
        (c) => c.durationType === "fixed" && c.endDate && isExpiringSoon(c.endDate, today)
      )
      .sort((a, b) => compareCivil(a.endDate as string, b.endDate as string))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        clientName: c.client.name,
        status: c.status,
        endDate: c.endDate as string,
        officialValue: moneyToJson(c.officialValue),
      }));

    return {
      kpis: {
        activeContractedValue: moneyToJson(activeContractedValue(contracts)),
        mrr: moneyToJson(mrr),
        arr: moneyToJson(arr),
        cashForecast: moneyToJson(forecastTotal(installments, from, to)),
        received: moneyToJson(receivedTotal(installments, from, to)),
        overdue: moneyToJson(overdueTotal(installments, today)),
        upsell: moneyToJson(sumChangeDeltas(changes, "upsell", from, to)),
        downsell: moneyToJson(sumChangeDeltas(changes, "downsell", from, to)),
        activeContracts: active.length,
        expiringSoon: expiringContracts.length,
      },
      monthly: groupMonthly(installments, from, to),
      overdueInstallments,
      expiringContracts,
    };
  });
}
```

- [ ] **Step 6: Run the service contract test to verify it passes**

```bash
npx vitest run src/__tests__/financial-services.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the domain suite and typecheck**

```bash
npx vitest run src/__tests__/financial-money.test.ts src/__tests__/financial-installments.test.ts src/__tests__/financial-metrics.test.ts src/__tests__/financial-lifecycle.test.ts src/__tests__/financial-services.test.ts
npx tsc --noEmit --incremental false
```

Expected: all PASS and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/financial/contracts-service.ts src/lib/financial/installments-service.ts src/lib/financial/overview-service.ts src/__tests__/financial-services.test.ts
git commit -m "feat(financial): add transactional financial services"
```

---

### Task 7: Add Clients API

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/clients/[id]/route.ts`
- Create: `src/__tests__/financial-clients-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-clients-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("clients API", () => {
  it("requires authentication on list and create", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("getUser()");
    expect(source).toContain("export async function GET");
    expect(source).toContain("export async function POST");
  });

  it("lists with server-side search and pagination", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("search");
    expect(source).toContain("page");
    expect(source).toContain("pageSize");
    expect(source).toContain("totalPages");
  });

  it("rejects duplicate cpf/cnpj as a conflict", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("P2002");
    expect(source).toContain("CONFLICT");
  });

  it("deactivates clients through a patch and never hard-deletes", () => {
    const source = read("src/app/api/clients/[id]/route.ts");
    expect(source).toContain("body.active");
    expect(source).toContain("export async function PATCH");
    expect(source).not.toContain("export async function DELETE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-clients-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the clients list and create route**

Create `src/app/api/clients/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );
  const activeOnly = searchParams.get("active") !== "false";

  const where = {
    ...(activeOnly ? { active: true } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { cpfCnpj: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { contracts: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    error: null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { name, legalName, cpfCnpj, email, phone, notes } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        legalName: legalName || null,
        cpfCnpj: cpfCnpj || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ data: client, error: null }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Implement the client detail, patch and deactivate route**

Create `src/app/api/clients/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { projects: true } },
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: client, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  try {
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        legalName: body.legalName !== undefined ? body.legalName : undefined,
        cpfCnpj: body.cpfCnpj !== undefined ? body.cpfCnpj || null : undefined,
        email: body.email !== undefined ? body.email || null : undefined,
        phone: body.phone !== undefined ? body.phone || null : undefined,
        notes: body.notes !== undefined ? body.notes || null : undefined,
        active: body.active !== undefined ? body.active : undefined,
      },
    });
    return NextResponse.json({ data: client, error: null });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }
    throw error;
  }
}
```

There is intentionally no `DELETE`: clients with financial history are
deactivated via `PATCH { active: false }`, which matches the spec rule.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-clients-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/clients/route.ts src/app/api/clients/[id]/route.ts src/__tests__/financial-clients-api.test.ts
git commit -m "feat(financial): add clients API"
```

---

### Task 8: Add Contracts API

**Files:**
- Create: `src/app/api/contracts/route.ts`
- Create: `src/app/api/contracts/[id]/route.ts`
- Create: `src/__tests__/financial-contracts-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-contracts-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("contracts API", () => {
  it("requires authentication on the contracts route", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("getUser()");
  });

  it("lists with server-side search, filters, sort and pagination", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("search");
    expect(source).toContain("status");
    expect(source).toContain("clientId");
    expect(source).toContain("projectId");
    expect(source).toContain("sortBy");
    expect(source).toContain("sortDir");
    expect(source).toContain("pageSize");
    expect(source).toContain("skip");
    expect(source).toContain("take");
  });

  it("creates draft contracts through the transactional service", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("createContractDraft");
    expect(source).toContain("VALIDATION_ERROR");
  });

  it("returns full detail with items, projects, installments, changes and audits", () => {
    const source = read("src/app/api/contracts/[id]/route.ts");
    expect(source).toContain("include:");
    expect(source).toContain("items");
    expect(source).toContain("projects");
    expect(source).toContain("installments");
    expect(source).toContain("changes");
    expect(source).toContain("audits");
  });

  it("only hard-deletes draft contracts", () => {
    const source = read("src/app/api/contracts/[id]/route.ts");
    expect(source).toContain("deleteDraftContract");
    expect(source).toContain("export async function DELETE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-contracts-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the contracts list and create route**

Create `src/app/api/contracts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { createContractDraft } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";

const SORT_FIELDS = ["code", "title", "status", "officialValue", "startDate", "endDate", "createdAt"] as const;

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";
  const sortByRaw = searchParams.get("sortBy") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const sortBy = (SORT_FIELDS as readonly string[]).includes(sortByRaw)
    ? (sortByRaw as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );

  const where = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { installments: true } },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contract.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    error: null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Title is required" } },
      { status: 400 }
    );
  }
  if (!body.clientId) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Client is required" } },
      { status: 400 }
    );
  }
  if (!body.durationType || !["fixed", "openEnded", "oneTime"].includes(body.durationType)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid duration type is required" } },
      { status: 400 }
    );
  }
  if (typeof body.officialValue !== "string" || isNaN(Number(body.officialValue))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Official value is required" } },
      { status: 400 }
    );
  }
  if (!body.startDate || typeof body.startDate !== "string" || !isCivilDate(body.startDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid start date is required" } },
      { status: 400 }
    );
  }
  if (body.endDate && !isCivilDate(body.endDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "End date must be a valid date" } },
      { status: 400 }
    );
  }

  try {
    const contract = await createContractDraft(
      {
        title: body.title,
        clientId: body.clientId,
        ownerId: body.ownerId ?? null,
        durationType: body.durationType,
        officialValue: String(body.officialValue),
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        billingFrequency: body.billingFrequency ?? null,
        paymentMethod: body.paymentMethod ?? "pix",
        documentUrl: body.documentUrl ?? null,
        notes: body.notes ?? null,
        items: body.items ?? [],
        projectIds: body.projectIds ?? [],
      },
      user.id
    );
    return NextResponse.json({ data: contract, error: null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: (error as { name?: string }).name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR",
          message: (error as Error).message,
        },
      },
      { status: (error as { name?: string }).name === "FinancialConflictError" ? 409 : 500 }
    );
  }
}
```

- [ ] **Step 4: Implement the contract detail, patch and delete route**

Create `src/app/api/contracts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  deleteDraftContract,
  updateContract,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      owner: { select: { id: true, name: true, email: true } },
      predecessor: { select: { id: true, code: true, title: true, status: true } },
      successors: { select: { id: true, code: true, title: true, status: true } },
      items: { orderBy: { position: "asc" } },
      projects: { include: { project: { select: { id: true, name: true } } } },
      installments: { orderBy: { dueDate: "asc" } },
      changes: {
        orderBy: { effectiveDate: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!contract) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Contract not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: contract, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const input: Record<string, unknown> = {};
  for (const field of [
    "title",
    "clientId",
    "ownerId",
    "durationType",
    "officialValue",
    "startDate",
    "endDate",
    "billingFrequency",
    "paymentMethod",
    "documentUrl",
    "notes",
    "status",
  ]) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.officialValue !== undefined) input.officialValue = String(input.officialValue);
  if (input.startDate !== undefined && !isCivilDate(input.startDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Start date must be a valid date" } },
      { status: 400 }
    );
  }

  try {
    const contract = await updateContract(params.id, input, user.id);
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    await deleteDraftContract(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-contracts-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/contracts/route.ts src/app/api/contracts/[id]/route.ts src/__tests__/financial-contracts-api.test.ts
git commit -m "feat(financial): add contracts API"
```

---

### Task 9: Add Lifecycle, Change and Installment APIs

**Files:**
- Create: `src/app/api/contracts/[id]/lifecycle/route.ts`
- Create: `src/app/api/contracts/[id]/changes/route.ts`
- Create: `src/app/api/installments/[id]/route.ts`
- Create: `src/app/api/installments/[id]/refund/route.ts`
- Create: `src/__tests__/financial-operations-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-operations-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("contract lifecycle API", () => {
  it("exposes lifecycle actions through a single route", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("applyLifecycleAction");
    expect(source).toContain("activate");
    expect(source).toContain("suspend");
    expect(source).toContain("resume");
    expect(source).toContain("close");
    expect(source).toContain("cancel");
    expect(source).toContain("renew");
    expect(source).toContain("AUTH_ERROR");
  });

  it("validates the installment plan before activation", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("plan");
  });

  it("requires an effective date to cancel", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("effectiveDate");
  });
});

describe("contract changes API", () => {
  it("proposes first and applies only after confirmation", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("applyContractChange");
    expect(source).toContain("confirm: body.confirm === true");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("strategy");
  });

  it("supports redistribute and adjust strategies", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("redistribute");
    expect(source).toContain("adjust");
  });
});

describe("installment APIs", () => {
  it("marks paid, cancels and records refunds without touching paid rows", () => {
    const source = read("src/app/api/installments/[id]/route.ts");
    expect(source).toContain("recordPayment");
    expect(source).toContain("cancelInstallment");
    expect(source).toContain("AUTH_ERROR");
  });

  it("enforces the linked refund rule", () => {
    const source = read("src/app/api/installments/[id]/refund/route.ts");
    expect(source).toContain("refundInstallment");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("CONFLICT");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-operations-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the lifecycle route**

Create `src/app/api/contracts/[id]/lifecycle/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  activateContract,
  applyLifecycleAction,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { validateFinitePlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

const ACTIONS = ["activate", "suspend", "resume", "close", "cancel", "renew"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const action = body.action;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Unknown lifecycle action" } },
      { status: 400 }
    );
  }

  try {
    if (action === "activate") {
      const plan = body.plan;
      if (!Array.isArray(plan) || plan.length === 0) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "An installment plan is required" } },
          { status: 400 }
        );
      }
      for (const item of plan) {
        if (!isCivilDate(item.dueDate)) {
          return NextResponse.json(
            { data: null, error: { code: "VALIDATION_ERROR", message: "Each installment needs a valid due date" } },
            { status: 400 }
          );
        }
        if (isNaN(Number(item.expectedAmount))) {
          return NextResponse.json(
            { data: null, error: { code: "VALIDATION_ERROR", message: "Each installment needs a valid amount" } },
            { status: 400 }
          );
        }
      }
      const contract = await activateContract(params.id, plan, user.id);
      return NextResponse.json({ data: contract, error: null });
    }

    if (action === "cancel" && !isCivilDate(body.effectiveDate ?? "")) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "An effective date is required to cancel" } },
        { status: 400 }
      );
    }

    const contract = await applyLifecycleAction(
      params.id,
      action,
      {
        effectiveDate: body.effectiveDate ?? undefined,
        retainedInstallmentIds: body.retainedInstallmentIds ?? [],
      },
      user.id
    );
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Implement the changes route**

Create `src/app/api/contracts/[id]/changes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { applyContractChange } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!["upsell", "downsell"].includes(body.type)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Type must be upsell or downsell" } },
      { status: 400 }
    );
  }
  if (!["redistribute", "adjust"].includes(body.strategy)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Strategy must be redistribute or adjust" } },
      { status: 400 }
    );
  }
  if (typeof body.delta !== "string" || isNaN(Number(body.delta))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A numeric delta is required" } },
      { status: 400 }
    );
  }
  if (!isCivilDate(body.effectiveDate ?? "")) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid effective date is required" } },
      { status: 400 }
    );
  }

  try {
    const result = await applyContractChange(
      params.id,
      {
        type: body.type,
        delta: body.delta,
        effectiveDate: body.effectiveDate,
        description: body.description ?? undefined,
        reason: body.reason ?? undefined,
        strategy: body.strategy,
        confirm: body.confirm === true,
      },
      user.id
    );
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 5: Implement the installment update route**

Create `src/app/api/installments/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  cancelInstallment,
  recordPayment,
} from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  try {
    if (body.action === "pay") {
      const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
      if (!isCivilDate(paidAt)) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "A valid payment date is required" } },
          { status: 400 }
        );
      }
      const installment = await recordPayment(params.id, paidAt, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    if (body.action === "cancel") {
      const installment = await cancelInstallment(params.id, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Unknown installment action" } },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 6: Implement the refund route**

Create `src/app/api/installments/[id]/refund/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { refundInstallment } from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (typeof body.refundAmount !== "string" || isNaN(Number(body.refundAmount))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A numeric refund amount is required" } },
      { status: 400 }
    );
  }
  const refundDate = body.refundDate ?? new Date().toISOString().slice(0, 10);
  if (!isCivilDate(refundDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid refund date is required" } },
      { status: 400 }
    );
  }

  try {
    const refund = await refundInstallment(
      params.id,
      body.refundAmount,
      refundDate,
      user.id
    );
    return NextResponse.json({ data: refund, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-operations-api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/contracts/[id]/lifecycle/route.ts src/app/api/contracts/[id]/changes/route.ts src/app/api/installments/[id]/route.ts src/app/api/installments/[id]/refund/route.ts src/__tests__/financial-operations-api.test.ts
git commit -m "feat(financial): add lifecycle change and installment APIs"
```

---

### Task 10: Add Overview API

**Files:**
- Create: `src/app/api/financial/overview/route.ts`
- Create: `src/__tests__/financial-overview-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-overview-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("overview API", () => {
  it("aggregates on the server and requires authentication", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("computeOverview");
    expect(source).toContain("export async function GET");
  });

  it("accepts period, client, status, project and installment filters", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("period");
    expect(source).toContain("clientId");
    expect(source).toContain("contractStatus");
    expect(source).toContain("projectId");
    expect(source).toContain("installmentStatus");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-overview-api.test.ts
```

Expected: FAIL — the route file does not exist.

- [ ] **Step 3: Implement the overview route**

Create `src/app/api/financial/overview/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { computeOverview } from "@/lib/financial/overview-service";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const periodRaw = searchParams.get("period") || "currentMonth";
  const period = ["currentMonth", "next90", "custom"].includes(periodRaw)
    ? (periodRaw as "currentMonth" | "next90" | "custom")
    : "currentMonth";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractStatus = searchParams.get("contractStatus") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const installmentStatus = searchParams.get("installmentStatus") || undefined;

  const data = await computeOverview({
    period,
    from,
    to,
    clientId,
    contractStatus,
    projectId,
    installmentStatus,
  });

  return NextResponse.json({ data, error: null });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-overview-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/financial/overview/route.ts src/__tests__/financial-overview-api.test.ts
git commit -m "feat(financial): add overview API"
```

---

### Task 11: Add CSV Export APIs

**Files:**
- Create: `src/lib/financial/csv.ts`
- Create: `src/app/api/financial/exports/contracts/route.ts`
- Create: `src/app/api/financial/exports/receivables/route.ts`
- Create: `src/__tests__/financial-exports.test.ts`

- [ ] **Step 1: Write the failing export contract test**

Create `src/__tests__/financial-exports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("CSV exports", () => {
  it("shares stable English headers and BRL money formatting", () => {
    const csv = read("src/lib/financial/csv.ts");
    expect(csv).toContain("export function csvEscape");
    expect(csv).toContain("formatBRL");
    expect(csv).toContain("\\ufeff");
  });

  it("exports contracts respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/contracts/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).toContain("findMany");
    expect(source).toContain("status");
    expect(source).toContain("clientId");
    expect(source).not.toContain("skip:");
  });

  it("exports receivables respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/receivables/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).not.toContain("skip:");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-exports.test.ts
```

Expected: FAIL — the csv helper and export routes do not exist.

- [ ] **Step 3: Create the CSV helper**

Create `src/lib/financial/csv.ts`:

```ts
import type { Money } from "./money";
import { formatBRL } from "./money";

export function csvEscape(value: string | number | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function moneyCell(value: Money): string {
  return csvEscape(formatBRL(value));
}

export function csvDocument(rows: string[][]): string {
  const body = rows.map((row) => row.join(",")).join("\n");
  return `\ufeff${body}\n`;
}

export const CONTRACTS_CSV_HEADERS = [
  "Code",
  "Title",
  "Client",
  "Status",
  "Duration Type",
  "Official Value (BRL)",
  "Start Date",
  "End Date",
  "Billing Frequency",
  "Payment Method",
  "Owner",
] as const;

export const RECEIVABLES_CSV_HEADERS = [
  "Contract Code",
  "Contract Title",
  "Client",
  "Expected Amount (BRL)",
  "Status",
  "Due Date",
  "Payment Method",
  "Paid Date",
] as const;
```

- [ ] **Step 4: Implement the contracts export route**

Create `src/app/api/financial/exports/contracts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import {
  CONTRACTS_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";

  const where = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      client: { select: { name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows = [
    [...CONTRACTS_CSV_HEADERS],
    ...contracts.map((contract) => [
      csvEscape(contract.code),
      csvEscape(contract.title),
      csvEscape(contract.client.name),
      csvEscape(contract.status),
      csvEscape(contract.durationType),
      moneyCell(toDecimal(contract.officialValue)),
      csvEscape(contract.startDate),
      csvEscape(contract.endDate),
      csvEscape(contract.billingFrequency),
      csvEscape(contract.paymentMethod),
      csvEscape(contract.owner?.name ?? ""),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contracts.csv"',
    },
  });
}
```

- [ ] **Step 5: Implement the receivables export route**

Create `src/app/api/financial/exports/receivables/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import { todayCivilDate } from "@/lib/financial/civil-date";
import {
  RECEIVABLES_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const today = todayCivilDate();

  const installments = await prisma.installment.findMany({
    where: {
      ...(status === "overdue"
        ? { status: "pending", dueDate: { lt: today } }
        : status
          ? { status }
          : {}),
      ...(clientId ? { contract: { clientId } } : {}),
      ...(projectId ? { contract: { projects: { some: { projectId } } } } : {}),
      ...(from ? { dueDate: { gte: from } } : {}),
      ...(to ? { dueDate: { lte: to } } : {}),
    },
    include: {
      contract: {
        include: { client: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = [
    [...RECEIVABLES_CSV_HEADERS],
    ...installments.map((installment) => [
      csvEscape(installment.contract.code),
      csvEscape(installment.contract.title),
      csvEscape(installment.contract.client.name),
      moneyCell(toDecimal(installment.expectedAmount)),
      csvEscape(installment.status),
      csvEscape(installment.dueDate),
      csvEscape(installment.paymentMethod),
      csvEscape(installment.paidAt),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="receivables.csv"',
    },
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-exports.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/csv.ts src/app/api/financial/exports/contracts/route.ts src/app/api/financial/exports/receivables/route.ts src/__tests__/financial-exports.test.ts
git commit -m "feat(financial): add CSV export APIs"
```

---

### Task 12: Add React Query Hooks

**Files:**
- Create: `src/lib/financial/http.ts`
- Create: `src/hooks/use-clients.ts`
- Create: `src/hooks/use-contracts.ts`
- Create: `src/hooks/use-installments.ts`
- Create: `src/hooks/use-overview.ts`
- Create: `src/hooks/use-financial-exports.ts`
- Create: `src/__tests__/financial-hooks.test.ts`

- [ ] **Step 1: Write the failing hooks contract test**

Create `src/__tests__/financial-hooks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial hooks", () => {
  it("shares a query-string and fetchJson helper", () => {
    const source = read("src/lib/financial/http.ts");
    expect(source).toContain("export function qs");
    expect(source).toContain("export async function fetchJson");
    expect(source).toContain("json.error");
  });

  it("encodes server-side filters into query keys", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('queryKey: ["contracts", filters]');
    expect(source).toContain("search");
    expect(source).toContain("pageSize");
  });

  it("invalidates contracts and overview after mutations", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('invalidateQueries({ queryKey: ["contracts"');
    expect(source).toContain('invalidateQueries({ queryKey: ["overview"');
  });

  it("builds overview queries with global filters", () => {
    const source = read("src/hooks/use-overview.ts");
    expect(source).toContain('queryKey: ["overview", filters]');
    expect(source).toContain("period");
    expect(source).toContain("clientId");
  });

  it("downloads filtered CSV exports as blobs", () => {
    const source = read("src/hooks/use-financial-exports.ts");
    expect(source).toContain("blob()");
    expect(source).toContain("createObjectURL");
    expect(source).toContain('a.download');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-hooks.test.ts
```

Expected: FAIL — the helper and hook files do not exist.

- [ ] **Step 3: Create the shared HTTP helper**

Create `src/lib/financial/http.ts`:

```ts
export function qs(
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}
```

- [ ] **Step 4: Create the clients hooks**

Create `src/hooks/use-clients.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type { Paginated } from "@/lib/financial/types";

export interface ClientData {
  id: string;
  name: string;
  legalName: string | null;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  _count?: { contracts: number };
}

export function useClients(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
  active?: boolean;
}) {
  return useQuery<Paginated<ClientData>>({
    queryKey: ["clients", filters],
    queryFn: () => fetchJson<Paginated<ClientData>>(`/api/clients${qs(filters)}`),
  });
}

export function useClient(clientId: string) {
  return useQuery<ClientData & { contracts?: unknown[] }>({
    queryKey: ["clients", clientId],
    queryFn: () => fetchJson(`/api/clients/${clientId}`),
    enabled: Boolean(clientId),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }) =>
      fetchJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to create client"),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
      active?: boolean;
    }) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to update client"),
  });
}

export function useDeactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to deactivate client"),
  });
}
```

- [ ] **Step 5: Create the contracts hooks**

Create `src/hooks/use-contracts.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type {
  ContractSummary,
  InstallmentPlanItem,
  Paginated,
} from "@/lib/financial/types";

export interface ContractDetail extends ContractSummary {
  client: { id: string; name: string };
  owner: { id: string; name: string | null; email: string } | null;
  predecessor: { id: string; code: string; title: string; status: string } | null;
  successors: Array<{ id: string; code: string; title: string; status: string }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: string | null;
    unit: string | null;
    price: string | null;
    position: number;
  }>;
  projects: Array<{ project: { id: string; name: string } }>;
  installments: Array<{
    id: string;
    expectedAmount: string;
    dueDate: string;
    paymentMethod: string;
    status: string;
    paidAt: string | null;
    refundOfId: string | null;
  }>;
  changes: Array<{
    id: string;
    type: string;
    delta: string;
    effectiveDate: string;
    description: string | null;
    previousValue: string;
    newValue: string;
    reason: string | null;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    field: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string | null;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
}

export interface ContractListFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
}

export function useContracts(filters: ContractListFilters) {
  return useQuery<Paginated<ContractSummary>>({
    queryKey: ["contracts", filters],
    queryFn: () =>
      fetchJson<Paginated<ContractSummary>>(`/api/contracts${qs(filters)}`),
  });
}

export function useContract(contractId: string) {
  return useQuery<ContractDetail>({
    queryKey: ["contracts", contractId],
    queryFn: () => fetchJson<ContractDetail>(`/api/contracts/${contractId}`),
    enabled: Boolean(contractId),
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      clientId: string;
      ownerId?: string;
      durationType: string;
      officialValue: string;
      startDate: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod: string;
      documentUrl?: string | null;
      notes?: string | null;
      items?: Array<{
        name: string;
        description?: string | null;
        quantity?: string | null;
        unit?: string | null;
        price?: string | null;
        position: number;
      }>;
      projectIds?: string[];
    }) =>
      fetchJson("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to create contract"),
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      clientId?: string;
      ownerId?: string | null;
      durationType?: string;
      officialValue?: string;
      startDate?: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod?: string;
      documentUrl?: string | null;
      notes?: string | null;
    }) =>
      fetchJson(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to update contract"),
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to delete contract"),
  });
}

export function useContractLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      plan,
      effectiveDate,
      retainedInstallmentIds,
    }: {
      id: string;
      action: string;
      plan?: InstallmentPlanItem[];
      effectiveDate?: string;
      retainedInstallmentIds?: string[];
    }) =>
      fetchJson(`/api/contracts/${id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          plan,
          effectiveDate,
          retainedInstallmentIds,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Lifecycle action failed"),
  });
}

export function useContractChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      type: "upsell" | "downsell";
      delta: string;
      effectiveDate: string;
      description?: string;
      reason?: string;
      strategy: "redistribute" | "adjust";
      confirm?: boolean;
    }) =>
      fetchJson(`/api/contracts/${id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to apply contract change"),
  });
}
```

- [ ] **Step 6: Create the installments hooks**

Create `src/hooks/use-installments.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string }) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paidAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to record payment"),
  });
}

export function useCancelInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to cancel installment"),
  });
}

export function useRefundInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      refundAmount,
      refundDate,
    }: {
      id: string;
      refundAmount: string;
      refundDate: string;
    }) =>
      fetchJson(`/api/installments/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount, refundDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to record refund"),
  });
}
```

- [ ] **Step 7: Create the overview hook**

Create `src/hooks/use-overview.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: string;
  projectId?: string;
  installmentStatus?: string;
}

export interface OverviewData {
  kpis: {
    activeContractedValue: string;
    mrr: string;
    arr: string;
    cashForecast: string;
    received: string;
    overdue: string;
    upsell: string;
    downsell: string;
    activeContracts: number;
    expiringSoon: number;
  };
  monthly: Array<{ month: string; forecast: string; received: string }>;
  overdueInstallments: Array<{
    id: string;
    contractCode: string;
    contractTitle: string;
    clientName: string;
    expectedAmount: string;
    dueDate: string;
  }>;
  expiringContracts: Array<{
    id: string;
    code: string;
    title: string;
    clientName: string;
    status: string;
    endDate: string;
    officialValue: string;
  }>;
}

export function useOverview(filters: OverviewFilters) {
  return useQuery<OverviewData>({
    queryKey: ["overview", filters],
    queryFn: () =>
      fetchJson<OverviewData>(`/api/financial/overview${qs(filters)}`),
    enabled: Boolean(filters.period),
  });
}
```

- [ ] **Step 8: Create the CSV export hooks**

Create `src/hooks/use-financial-exports.ts`:

```ts
import { toastError } from "@/lib/toast";
import { qs } from "@/lib/financial/http";

export interface ContractExportFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
}

export interface ReceivablesExportFilters {
  status?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

async function downloadCsv(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Export failed");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function exportContractsCsv(
  filters: ContractExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/contracts${qs(filters)}`,
      "contracts.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}

export async function exportReceivablesCsv(
  filters: ReceivablesExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/receivables${qs(filters)}`,
      "receivables.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-hooks.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/financial/http.ts src/hooks/use-clients.ts src/hooks/use-contracts.ts src/hooks/use-installments.ts src/hooks/use-overview.ts src/hooks/use-financial-exports.ts src/__tests__/financial-hooks.test.ts
git commit -m "feat(financial): add React Query hooks"
```

---

### Task 13: Add Financial Navigation and Overview UI

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Create: `src/components/financial/financial-tabs.tsx`
- Create: `src/app/(authenticated)/financial/layout.tsx`
- Create: `src/components/financial/shared/kpi-card.tsx`
- Create: `src/components/financial/shared/money-text.tsx`
- Create: `src/components/financial/shared/status-badge.tsx`
- Create: `src/components/financial/shared/civil-date-text.tsx`
- Create: `src/components/financial/shared/empty-state.tsx`
- Create: `src/components/financial/shared/error-state.tsx`
- Create: `src/components/financial/overview/forecast-received-chart.tsx`
- Create: `src/components/financial/overview/financial-filters.tsx`
- Create: `src/components/financial/overview/overview-page.tsx`
- Create: `src/app/(authenticated)/financial/page.tsx`
- Create: `src/__tests__/financial-overview-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-overview-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("financial overview UI", () => {
  it("adds a Financial entry to the sidebar navigation", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(sidebar).toContain('href: "/financial"');
    expect(sidebar).toContain('label: "Financial"');
    expect(sidebar).toContain("nav-financial");
  });

  it("keeps the overview route and layout present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/page.tsx",
      "src/app/(authenticated)/financial/layout.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders the forecast versus received chart accessibly", () => {
    const chart = read("src/components/financial/overview/forecast-received-chart.tsx");
    expect(chart).toContain("role=\"img\"");
    expect(chart).toContain("aria-label");
    expect(chart).toContain("svg");
  });

  it("exposes KPI cards with labels and money formatting", () => {
    const kpi = read("src/components/financial/shared/kpi-card.tsx");
    expect(kpi).toContain("formatBRL");
    expect(kpi).toContain("aria-label");
  });

  it("passes global filters to the overview query", () => {
    const page = read("src/app/(authenticated)/financial/page.tsx");
    expect(page).toContain("<OverviewPage");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-overview-ui.test.ts
```

Expected: FAIL — the pages and components do not exist.

- [ ] **Step 3: Add the sidebar navigation item**

In `src/components/layout/sidebar.tsx`, import `Wallet` from `lucide-react` by
adding it to the existing import block, then add the item after the Documents
entry in `navItems`:

```tsx
  { href: "/financial", label: "Financial", icon: Wallet, testId: "nav-financial" },
```

- [ ] **Step 4: Create the shared presentational components**

Create `src/components/financial/shared/money-text.tsx`:

```tsx
import { toDecimal, formatBRL } from "@/lib/financial/money";

export function MoneyText({ value, className }: { value: string; className?: string }) {
  return <span className={className}>{formatBRL(toDecimal(value))}</span>;
}
```

Create `src/components/financial/shared/civil-date-text.tsx`:

```tsx
import { formatCivilDate } from "@/lib/financial/civil-date";

export function CivilDateText({
  date,
  className,
}: {
  date: string | null;
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  return <span className={className}>{formatCivilDate(date)}</span>;
}
```

Create `src/components/financial/shared/status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-bg-secondary text-text-secondary",
  active: "bg-success-bg text-success",
  closed: "bg-bg-secondary text-text-secondary",
  cancelled: "bg-danger-bg text-danger",
  suspended: "bg-warning-bg text-warning",
  pending: "bg-warning-bg text-warning",
  paid: "bg-success-bg text-success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status] ?? "bg-bg-secondary text-text-secondary"
      )}
    >
      {status}
    </span>
  );
}
```

Create `src/components/financial/shared/kpi-card.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { formatBRL, toDecimal } from "@/lib/financial/money";

export function KpiCard({
  label,
  value,
  isMoney = true,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  isMoney?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-page-alt p-4",
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">
        {isMoney ? formatBRL(toDecimal(String(value))) : value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
```

Create `src/components/financial/shared/empty-state.tsx`:

```tsx
export function FinancialEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
```

Create `src/components/financial/shared/error-state.tsx`:

```tsx
export function FinancialErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-danger bg-danger-bg p-4 text-sm text-danger">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the forecast versus received chart**

Create `src/components/financial/overview/forecast-received-chart.tsx`:

```tsx
"use client";

interface ChartPoint {
  month: string;
  forecast: string;
  received: string;
}

const BAR_GAP = 4;

export function ForecastReceivedChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [Number(point.forecast), Number(point.received)])
  );
  const width = 640;
  const height = 240;
  const labelSpace = 44;
  const plotWidth = width - labelSpace;
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(4, groupWidth / 2 - BAR_GAP);

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Forecast versus received, months ${data[0]?.month ?? ""} through ${data[data.length - 1]?.month ?? ""}`}
        className="h-56 w-full min-w-[560px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = labelSpace + (height - labelSpace) * ratio;
          return (
            <line
              key={ratio}
              x1={labelSpace}
              y1={y}
              x2={width}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}
        {data.map((point, index) => {
          const centerX = labelSpace + groupWidth * index + groupWidth / 2;
          const forecastHeight = (Number(point.forecast) / max) * (height - labelSpace);
          const receivedHeight = (Number(point.received) / max) * (height - labelSpace);
          return (
            <g key={point.month}>
              <rect
                x={centerX - barWidth - 1}
                y={height - forecastHeight}
                width={barWidth}
                height={forecastHeight}
                fill="var(--color-accent)"
              >
                <title>{`${point.month} forecast: R$ ${point.forecast}`}</title>
              </rect>
              <rect
                x={centerX + 1}
                y={height - receivedHeight}
                width={barWidth}
                height={receivedHeight}
                fill="var(--color-success)"
              >
                <title>{`${point.month} received: R$ ${point.received}`}</title>
              </rect>
              <text
                x={centerX}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-secondary)"
              >
                {point.month}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Forecast
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" /> Received
        </span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 6: Create the global filters and the overview page**

Create `src/components/financial/overview/financial-filters.tsx`:

```tsx
"use client";

import type { OverviewFilters } from "@/hooks/use-overview";

const PERIODS = [
  { value: "currentMonth", label: "Current month" },
  { value: "next90", label: "Next 90 days" },
  { value: "custom", label: "Custom" },
] as const;

export function FinancialFilters({
  filters,
  onChange,
}: {
  filters: OverviewFilters;
  onChange: (next: OverviewFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => onChange({ ...filters, period: period.value })}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filters.period === period.value
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
      {filters.period === "custom" && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">
            From
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ ...filters, from: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-text-secondary">
            To
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ ...filters, to: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

Create `src/components/financial/overview/overview-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useOverview, type OverviewFilters } from "@/hooks/use-overview";
import { KpiCard } from "@/components/financial/shared/kpi-card";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ForecastReceivedChart } from "@/components/financial/overview/forecast-received-chart";
import { FinancialFilters } from "@/components/financial/overview/financial-filters";
import { LoadingState } from "@/components/shared/loading-state";

export function OverviewPage() {
  const [filters, setFilters] = useState<OverviewFilters>({
    period: "currentMonth",
  });
  const { data, isLoading, isError, refetch } = useOverview(filters);

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load the financial overview" onRetry={() => refetch()} />;
  }

  const { kpis, monthly, overdueInstallments, expiringContracts } = data;

  return (
    <div className="space-y-6">
      <FinancialFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active contracted value" value={kpis.activeContractedValue} />
        <KpiCard label="MRR" value={kpis.mrr} />
        <KpiCard label="ARR" value={kpis.arr} />
        <KpiCard label="Cash forecast" value={kpis.cashForecast} />
        <KpiCard label="Received" value={kpis.received} />
        <KpiCard label="Overdue" value={kpis.overdue} />
        <KpiCard label="Upsell" value={kpis.upsell} />
        <KpiCard label="Downsell" value={kpis.downsell} />
        <KpiCard label="Active contracts" value={kpis.activeContracts} isMoney={false} />
        <KpiCard label="Expiring soon" value={kpis.expiringSoon} isMoney={false} />
      </div>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="mb-2 text-base font-semibold text-text-primary">
          Forecast vs. Received
        </h2>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <ForecastReceivedChart data={monthly} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="overdue-title">
          <h2 id="overdue-title" className="mb-2 text-base font-semibold text-text-primary">
            Overdue installments
          </h2>
          {overdueInstallments.length === 0 ? (
            <FinancialEmptyState title="Nothing overdue" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {overdueInstallments.map((installment) => (
                <li key={installment.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{installment.contractTitle}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {installment.clientName} · {installment.contractCode}
                    </p>
                  </div>
                  <CivilDateText date={installment.dueDate} className="text-xs text-text-muted" />
                  <MoneyText value={installment.expectedAmount} className="font-semibold text-danger" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="expiring-title">
          <h2 id="expiring-title" className="mb-2 text-base font-semibold text-text-primary">
            Expiring contracts
          </h2>
          {expiringContracts.length === 0 ? (
            <FinancialEmptyState title="Nothing expiring in the next 30 days" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {expiringContracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{contract.title}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {contract.clientName} · {contract.code}
                    </p>
                  </div>
                  <StatusBadge status={contract.status ?? "active"} />
                  <CivilDateText date={contract.endDate} className="text-xs text-text-muted" />
                  <MoneyText value={contract.officialValue} className="font-semibold text-text-primary" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

Note: the client, project, contract-status and installment-status global
filters are wired in Task 17, which re-adds the `useProjects`/`useClients`
queries and the select controls to this page.

- [ ] **Step 7: Create the tabs, layout and overview page**

Create `src/components/financial/financial-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/financial", label: "Overview", exact: true },
  { href: "/financial/contracts", label: "Contracts" },
  { href: "/financial/receivables", label: "Receivables" },
  { href: "/financial/clients", label: "Clients" },
];

export function FinancialTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Financial sections" className="mb-4 flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-h-[44px] items-center rounded-md px-4 py-2 text-sm font-medium",
              active
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `src/app/(authenticated)/financial/layout.tsx`:

```tsx
"use client";

import { FinancialTabs } from "@/components/financial/financial-tabs";

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <FinancialTabs />
      {children}
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/page.tsx`:

```tsx
"use client";

import { OverviewPage } from "@/components/financial/overview/overview-page";

export default function FinancialOverviewPage() {
  return <OverviewPage />;
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-overview-ui.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean. If `projects` or `clientsData` are reported unused, prefix
them with an underscore in `overview-page.tsx` (for example `const { data: _projects }`).

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/financial/financial-tabs.tsx "src/app/(authenticated)/financial/layout.tsx" src/components/financial/shared/kpi-card.tsx src/components/financial/shared/money-text.tsx src/components/financial/shared/status-badge.tsx src/components/financial/shared/civil-date-text.tsx src/components/financial/shared/empty-state.tsx src/components/financial/shared/error-state.tsx src/components/financial/overview/forecast-received-chart.tsx src/components/financial/overview/financial-filters.tsx src/components/financial/overview/overview-page.tsx "src/app/(authenticated)/financial/page.tsx" src/__tests__/financial-overview-ui.test.ts
git commit -m "feat(financial): add overview UI and navigation"
```

---

### Task 14: Add Contracts UI

**Files:**
- Create: `src/components/financial/contracts/contract-list.tsx`
- Create: `src/components/financial/contracts/contract-search-filters.tsx`
- Create: `src/components/financial/contracts/pagination.tsx`
- Create: `src/components/financial/contracts/csv-export-button.tsx`
- Create: `src/components/financial/contracts/contract-form.tsx`
- Create: `src/components/financial/contracts/contract-detail.tsx`
- Create: `src/components/financial/contracts/lifecycle-actions.tsx`
- Create: `src/components/financial/contracts/change-dialog.tsx`
- Create: `src/app/(authenticated)/financial/contracts/page.tsx`
- Create: `src/app/(authenticated)/financial/contracts/new/page.tsx`
- Create: `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`
- Create: `src/__tests__/financial-contracts-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-contracts-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("contracts UI", () => {
  it("keeps the list, new and detail routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/contracts/page.tsx",
      "src/app/(authenticated)/financial/contracts/new/page.tsx",
      "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders one scrollable form with collapsible sections", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Contract data");
    expect(form).toContain("Scope and items");
    expect(form).toContain("Linked projects");
    expect(form).toContain("Billing and installments");
    expect(form).toContain("toggleSection");
  });

  it("shows a financial consistency summary before activation", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Installment total");
    expect(form).toContain("Official value");
    expect(form).toContain("useContractLifecycle");
    expect(form).toContain('action: "activate"');
  });

  it("exposes lifecycle actions including renew and cancel", () => {
    const actions = read("src/components/financial/contracts/lifecycle-actions.tsx");
    expect(actions).toContain("activate");
    expect(actions).toContain("suspend");
    expect(actions).toContain("resume");
    expect(actions).toContain("close");
    expect(actions).toContain("cancel");
    expect(actions).toContain("renew");
  });

  it("lists contracts with server-side filters and CSV export", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("useContracts");
    expect(list).toContain("exportContractsCsv");
  });

  it("shows a two-step confirmation for upsell and downsell", () => {
    const dialog = read("src/components/financial/contracts/change-dialog.tsx");
    expect(dialog).toContain("proposal");
    expect(dialog).toContain("confirm");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-contracts-ui.test.ts
```

Expected: FAIL — the components and pages do not exist.

- [ ] **Step 3: Create the pagination and CSV button primitives**

Create `src/components/financial/contracts/pagination.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 py-3 text-sm text-text-secondary">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Next page"
      >
        Next <ChevronRight size={16} />
      </button>
    </nav>
  );
}
```

Create `src/components/financial/contracts/csv-export-button.tsx`:

```tsx
"use client";

import { Download } from "lucide-react";

export function CsvExportButton({
  onExport,
  label = "Export CSV",
}: {
  onExport: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onExport}
      className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-page-alt px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
    >
      <Download size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Create the list filters, list and list page**

Create `src/components/financial/contracts/contract-search-filters.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export interface ContractFiltersValue {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
}

export function ContractSearchFilters({
  values,
  onChange,
  clients,
  projects,
}: {
  values: ContractFiltersValue;
  onChange: (next: ContractFiltersValue) => void;
  clients?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
}) {
  const [query, setQuery] = useState(values.search ?? "");
  const statuses = ["draft", "active", "closed", "cancelled", "suspended"];

  function submitSearch() {
    onChange({ ...values, search: query.trim() || undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="contract-search" className="sr-only">
          Search contracts
        </label>
        <input
          id="contract-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch();
          }}
          placeholder="Search by title, code or client"
          className="w-56 rounded-md border border-border bg-page-alt px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submitSearch}
          className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          aria-label="Search contracts"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>

      <label className="text-sm text-text-secondary">
        Status
        <select
          value={values.status ?? ""}
          onChange={(event) =>
            onChange({ ...values, status: event.target.value || undefined })
          }
          className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      {clients && clients.length > 0 && (
        <label className="text-sm text-text-secondary">
          Client
          <select
            value={values.clientId ?? ""}
            onChange={(event) =>
              onChange({ ...values, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {projects && projects.length > 0 && (
        <label className="text-sm text-text-secondary">
          Project
          <select
            value={values.projectId ?? ""}
            onChange={(event) =>
              onChange({ ...values, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
```

Create `src/components/financial/contracts/contract-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useContracts, type ContractListFilters } from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { exportContractsCsv } from "@/hooks/use-financial-exports";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ContractSearchFilters } from "@/components/financial/contracts/contract-search-filters";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractList() {
  const [filters, setFilters] = useState<ContractListFilters>({
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const { data, isLoading, isError, refetch } = useContracts(filters);
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load contracts" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContractSearchFilters
          values={filters}
          onChange={(next) => setFilters({ ...filters, ...next, page: 1 })}
          clients={clientsData?.items}
          projects={projects}
        />
        <div className="flex items-center gap-2">
          <CsvExportButton onExport={() => exportContractsCsv(filters)} />
          <Link
            href="/financial/contracts/new"
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} aria-hidden="true" /> New contract
          </Link>
        </div>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No contracts match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Contracts</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Code</th>
                <th scope="col" className="px-3 py-2 font-medium">Title</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Official value</th>
                <th scope="col" className="px-3 py-2 font-medium">Start</th>
                <th scope="col" className="px-3 py-2 font-medium">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((contract) => (
                <tr key={contract.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{contract.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{contract.client.name}</td>
                  <td className="px-3 py-2"><StatusBadge status={contract.status} /></td>
                  <td className="px-3 py-2 font-medium"><MoneyText value={contract.officialValue} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.startDate} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.endDate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/contracts/page.tsx`:

```tsx
"use client";

import { ContractList } from "@/components/financial/contracts/contract-list";

export default function FinancialContractsPage() {
  return <ContractList />;
}
```

- [ ] **Step 5: Create the contract form**

Create `src/components/financial/contracts/contract-form.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateContract,
  useUpdateContract,
  useContract,
  useContractLifecycle,
} from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { suggestPlan, sumPlan, validateFinitePlan } from "@/lib/financial/installments";
import { toDecimal, eq, formatBRL } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { ContractDetail } from "@/hooks/use-contracts";

const DURATION_TYPES = [
  { value: "fixed", label: "Fixed term" },
  { value: "openEnded", label: "Open-ended recurring" },
  { value: "oneTime", label: "One-time" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "annual", label: "Annual" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

interface ItemRow {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  position: number;
}

export function ContractForm({ contractId }: { contractId?: string }) {
  const router = useRouter();
  const { data: existing } = useContract(contractId ?? "");
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();
  const { data: profiles } = useProfiles();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? "");
  const [durationType, setDurationType] = useState(existing?.durationType ?? "fixed");
  const [officialValue, setOfficialValue] = useState(existing?.officialValue ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? "");
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [billingFrequency, setBillingFrequency] = useState(existing?.billingFrequency ?? "monthly");
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod ?? "pix");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    contract: true,
    scope: true,
    projects: true,
    billing: true,
  });

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const lifecycle = useContractLifecycle();

  const itemSum = useMemo(
    () =>
      items.reduce(
        (acc, item) =>
          acc.plus(
            toDecimal(item.price ?? "0").times(toDecimal(item.quantity ?? "0"))
          ),
        toDecimal(0)
      ),
    [items]
  );

  const suggestedPlan = useMemo(() => {
    if (!officialValue || !startDate) return [];
    try {
      return suggestPlan(
        toDecimal(officialValue),
        durationType as "fixed" | "openEnded" | "oneTime",
        startDate,
        endDate || null,
        (billingFrequency as "monthly" | "quarterly" | "semiannual" | "annual") || null,
        paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [officialValue, startDate, endDate, durationType, billingFrequency, paymentMethod]);

  const planTotal = useMemo(() => sumPlan(suggestedPlan), [suggestedPlan]);
  const planErrors =
    durationType === "openEnded"
      ? !eq(planTotal, toDecimal(officialValue))
        ? ["Installment total must equal the official contract value"]
        : []
      : validateFinitePlan(suggestedPlan, toDecimal(officialValue || "0"));
  const itemMismatch = items.length > 0 && !eq(itemSum, toDecimal(officialValue || "0"));

  function payload(extra: Record<string, unknown> = {}) {
    return {
      title,
      clientId,
      ownerId: ownerId || undefined,
      durationType,
      officialValue,
      startDate,
      endDate: endDate || null,
      billingFrequency,
      paymentMethod,
      notes: notes || null,
      items: items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          position: item.position,
        })),
      projectIds,
      ...extra,
    };
  }

  function saveDraft() {
    if (contractId) {
      updateContract.mutate({ id: contractId, ...payload() });
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          router.push(`/financial/contracts/${(contract as { id: string }).id}`);
        },
      });
    }
  }

  function activate() {
    const navigate = (id: string) => {
      lifecycle.mutate(
        { id, action: "activate", plan: suggestedPlan },
        {
          onSuccess: () => {
            toastSuccess("Contract activated");
            router.push(`/financial/contracts/${id}`);
          },
        }
      );
    };
    if (contractId) {
      navigate(contractId);
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          navigate((contract as { id: string }).id);
        },
      });
    }
  }

  function toggleSection(key: string) {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("contract")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Contract data</h2>
          {sectionsOpen.contract ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.contract && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contract-title">Title</Label>
              <Input id="contract-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-client">Client</Label>
              <select
                id="contract-client"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">Select client</option>
                {clientsData?.items.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-owner">Internal owner</Label>
              <select
                id="contract-owner"
                value={ownerId ?? ""}
                onChange={(event) => setOwnerId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {profiles?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-duration">Duration type</Label>
              <select
                id="contract-duration"
                value={durationType}
                onChange={(event) => setDurationType(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {DURATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-value">Official value (BRL)</Label>
              <Input
                id="contract-value"
                type="number"
                step="0.01"
                min="0"
                value={officialValue}
                onChange={(event) => setOfficialValue(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-start">Start date</Label>
              <Input id="contract-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-end">End date</Label>
              <Input
                id="contract-end"
                type="date"
                value={endDate}
                disabled={durationType === "openEnded" || durationType === "oneTime"}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-frequency">Billing frequency</Label>
              <select
                id="contract-frequency"
                value={billingFrequency ?? "monthly"}
                disabled={durationType === "oneTime"}
                onChange={(event) => setBillingFrequency(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-payment">Payment method</Label>
              <select
                id="contract-payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contract-notes">Notes</Label>
              <textarea
                id="contract-notes"
                value={notes ?? ""}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("scope")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Scope and items</h2>
          {sectionsOpen.scope ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.scope && (
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <input
                  aria-label={`Item name ${index + 1}`}
                  value={item.name}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                  }
                  placeholder="Item name"
                  className="col-span-2 rounded-md border border-border bg-page px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  aria-label={`Item price ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.price ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, price: event.target.value } : row)))
                  }
                  placeholder="Price"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <input
                  aria-label={`Item quantity ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.quantity ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))
                  }
                  placeholder="Qty"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  className="flex min-h-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { name: "", position: prev.length },
                ])
              }
              className="flex min-h-[44px] items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
            >
              <Plus size={16} /> Add item
            </button>
            {itemMismatch && (
              <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">
                The item-price sum ({formatBRL(itemSum)}) does not match the
                official contract value ({formatBRL(toDecimal(officialValue || "0"))}).
                This warning does not block saving.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("projects")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Linked projects</h2>
          {sectionsOpen.projects ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.projects && (
          <div className="mt-4 space-y-2">
            {projects?.map((project) => (
              <label key={project.id} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={(event) =>
                    setProjectIds((prev) =>
                      event.target.checked
                        ? [...prev, project.id]
                        : prev.filter((id) => id !== project.id)
                    )
                  }
                  className="h-4 w-4"
                />
                {project.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("billing")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Billing and installments</h2>
          {sectionsOpen.billing ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.billing && (
          <div className="mt-4 space-y-3">
            {suggestedPlan.length === 0 ? (
              <p className="text-sm text-text-muted">
                Fill in the value and dates to preview the suggested installment schedule.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs uppercase text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                      <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                      <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suggestedPlan.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-1">{item.dueDate}</td>
                        <td className="px-3 py-1 font-medium">{formatBRL(toDecimal(item.expectedAmount))}</td>
                        <td className="px-3 py-1">{item.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-text-secondary">
              Installment total: {formatBRL(planTotal)} · Official value:{" "}
              {formatBRL(toDecimal(officialValue || "0"))}
            </p>
            {planErrors.map((error) => (
              <p key={error} role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">
                {error}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={saveDraft}>
          Save draft
        </Button>
        {(!existing || existing.status === "draft") && (
          <Button
            onClick={activate}
            disabled={suggestedPlan.length === 0 || planErrors.length > 0}
          >
            Activate
          </Button>
        )}
      </div>
    </div>
  );
}
```

The activation flow is now real: clicking **Activate** saves the draft through
`POST /api/contracts` when no contract exists yet (or patches the existing
draft) and then runs the transactional `activateContract` through
`POST /api/contracts/[id]/lifecycle` with the server-consistent
`suggestedPlan`. The button is disabled until a consistent installment plan
exists, mirroring the activation validation on the server.

Create `src/app/(authenticated)/financial/contracts/new/page.tsx`:

```tsx
"use client";

import { ContractForm } from "@/components/financial/contracts/contract-form";

export default function NewContractPage() {
  return <ContractForm />;
}
```

- [ ] **Step 6: Create the detail, lifecycle actions and change dialog**

Create `src/components/financial/contracts/lifecycle-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractLifecycle } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import type { InstallmentPlanItem } from "@/lib/financial/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LifecycleActions({
  contractId,
  status,
  plan,
}: {
  contractId: string;
  status: string;
  plan?: InstallmentPlanItem[];
}) {
  const router = useRouter();
  const lifecycle = useContractLifecycle();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");

  function run(action: string, extra: Record<string, unknown> = {}) {
    lifecycle.mutate(
      { id: contractId, action, ...extra },
      {
        onSuccess: () => {
          toastSuccess(`Contract ${action.replace("_", " ")}`);
          router.refresh();
        },
      }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <Button
          onClick={() => run("activate", { plan })}
          disabled={!plan || plan.length === 0}
        >
          Activate
        </Button>
      )}
      {status === "active" && (
        <Button variant="outline" onClick={() => run("suspend")}>
          Suspend
        </Button>
      )}
      {status === "suspended" && (
        <Button variant="outline" onClick={() => run("resume")}>
          Resume
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("close")}>
          Close
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("renew")}>
          Renew
        </Button>
      )}
      {(status === "active" || status === "suspended" || status === "draft") && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancel
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel contract</DialogTitle>
            <DialogDescription>
              Future installments after the effective date will be cancelled.
              Paid and already overdue installments remain collectible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="cancel-date" className="text-sm text-text-secondary">
              Effective date
            </label>
            <input
              id="cancel-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep contract
            </Button>
            <Button
              variant="destructive"
              disabled={!effectiveDate}
              onClick={() => {
                run("cancel", { effectiveDate, retainedInstallmentIds: [] });
                setCancelOpen(false);
              }}
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Create `src/components/financial/contracts/change-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useContractChange } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChangeDialog({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useContractChange();
  const [type, setType] = useState<"upsell" | "downsell">("upsell");
  const [delta, setDelta] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [strategy, setStrategy] = useState<"redistribute" | "adjust">("redistribute");
  const [proposal, setProposal] = useState<unknown>(null);

  function requestProposal(confirm = false) {
    change.mutate(
      {
        id: contractId,
        type,
        delta,
        effectiveDate,
        description: description || undefined,
        strategy,
        confirm,
      },
      {
        onSuccess: (result) => {
          const data = result as { applied: boolean; proposal?: unknown };
          if (!data.applied) {
            setProposal(data.proposal ?? null);
          } else {
            toastSuccess("Contract value updated");
            setProposal(null);
            onOpenChange(false);
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust contract value</DialogTitle>
          <DialogDescription>
            Review the proposed change before applying it. Paid installments
            are never modified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "upsell" | "downsell")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm"
              >
                <option value="upsell">Upsell</option>
                <option value="downsell">Downsell</option>
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              Strategy
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as "redistribute" | "adjust")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm"
              >
                <option value="redistribute">Redistribute across pending</option>
                <option value="adjust">Additional / negative installment</option>
              </select>
            </label>
          </div>
          <label className="block text-sm text-text-secondary">
            Delta (BRL)
            <input
              type="number"
              step="0.01"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Effective date
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          {proposal && (
            <div className="rounded-md bg-bg-secondary p-3 text-sm text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">Proposed result</p>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(proposal, null, 2)}</pre>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!proposal && (
            <Button
              disabled={!delta || !effectiveDate}
              onClick={() => requestProposal(false)}
            >
              Preview proposal
            </Button>
          )}
          {proposal && (
            <Button onClick={() => requestProposal(true)}>Confirm and apply</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/components/financial/contracts/contract-detail.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useContract } from "@/hooks/use-contracts";
import { useMarkInstallmentPaid } from "@/hooks/use-installments";
import { suggestPlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { LifecycleActions } from "@/components/financial/contracts/lifecycle-actions";
import { ChangeDialog } from "@/components/financial/contracts/change-dialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractDetail({ contractId }: { contractId: string }) {
  const { data: contract, isLoading, isError, refetch } = useContract(contractId);
  const markPaid = useMarkInstallmentPaid();
  const [changeOpen, setChangeOpen] = useState(false);

  const activationPlan = useMemo(() => {
    if (!contract) return [];
    try {
      return suggestPlan(
        toDecimal(contract.officialValue),
        contract.durationType,
        contract.startDate,
        contract.endDate,
        contract.billingFrequency,
        contract.paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [contract]);

  if (isLoading) return <LoadingState />;
  if (isError || !contract) {
    return <FinancialErrorState message="Failed to load the contract" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">{contract.code}</p>
          <h1 className="text-xl font-semibold text-text-primary">{contract.title}</h1>
          <p className="text-sm text-text-secondary">{contract.client.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={contract.status} />
          <div className="flex flex-wrap gap-2">
            <LifecycleActions
              contractId={contract.id}
              status={contract.status}
              plan={activationPlan}
            />
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => setChangeOpen(true)}>
                Adjust value
              </Button>
            )}
          </div>
        </div>
      </div>

      <section aria-labelledby="commercial-summary" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="commercial-summary" className="mb-3 text-base font-semibold text-text-primary">
          Commercial summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Official value</dt>
            <dd className="font-semibold text-text-primary"><MoneyText value={contract.officialValue} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Duration</dt>
            <dd className="text-text-primary">{contract.durationType}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Start</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.startDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">End</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.endDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Billing frequency</dt>
            <dd className="text-text-primary">{contract.billingFrequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Payment method</dt>
            <dd className="text-text-primary">{contract.paymentMethod}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="items-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="items-title" className="mb-3 text-base font-semibold text-text-primary">Items</h2>
        {contract.items.length === 0 ? (
          <p className="text-sm text-text-muted">No items recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Name</th>
                  <th scope="col" className="px-3 py-1 font-medium">Quantity</th>
                  <th scope="col" className="px-3 py-1 font-medium">Unit</th>
                  <th scope="col" className="px-3 py-1 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1 font-medium">{item.name}</td>
                    <td className="px-3 py-1">{item.quantity ?? "—"}</td>
                    <td className="px-3 py-1">{item.unit ?? "—"}</td>
                    <td className="px-3 py-1">{item.price ? <MoneyText value={item.price} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="projects-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="projects-title" className="mb-3 text-base font-semibold text-text-primary">Linked projects</h2>
        {contract.projects.length === 0 ? (
          <p className="text-sm text-text-muted">No linked projects.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {contract.projects.map((link) => (
              <li key={link.project.id} className="rounded-md bg-bg-secondary px-3 py-1 text-sm text-text-secondary">
                {link.project.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="installments-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="installments-title" className="mb-3 text-base font-semibold text-text-primary">Installments</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                <th scope="col" className="px-3 py-1 font-medium">Status</th>
                <th scope="col" className="px-3 py-1 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                <th scope="col" className="px-3 py-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contract.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-1"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-1 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-1"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-1"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-1">{installment.paymentMethod}</td>
                  <td className="px-3 py-1">
                    {installment.status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          markPaid.mutate({
                            id: installment.id,
                            paidAt: new Date().toISOString().slice(0, 10),
                          })
                        }
                        className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {contract.changes.length > 0 && (
        <section aria-labelledby="changes-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="changes-title" className="mb-3 text-base font-semibold text-text-primary">Upsell and downsell history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Type</th>
                  <th scope="col" className="px-3 py-1 font-medium">Delta</th>
                  <th scope="col" className="px-3 py-1 font-medium">Effective</th>
                  <th scope="col" className="px-3 py-1 font-medium">Previous</th>
                  <th scope="col" className="px-3 py-1 font-medium">New</th>
                  <th scope="col" className="px-3 py-1 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.changes.map((change) => (
                  <tr key={change.id}>
                    <td className="px-3 py-1 capitalize">{change.type}</td>
                    <td className="px-3 py-1 font-medium"><MoneyText value={change.delta} /></td>
                    <td className="px-3 py-1"><CivilDateText date={change.effectiveDate} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.previousValue} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.newValue} /></td>
                    <td className="px-3 py-1 text-text-secondary">{change.reason ?? change.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {contract.audits.length > 0 && (
        <section aria-labelledby="audit-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="audit-title" className="mb-3 text-base font-semibold text-text-primary">Audit history</h2>
          <ul className="divide-y divide-border text-sm">
            {contract.audits.map((audit) => (
              <li key={audit.id} className="py-2">
                <p className="text-text-primary">
                  <span className="font-medium">{audit.field}</span> changed
                  {audit.reason ? ` — ${audit.reason}` : ""}
                </p>
                <p className="text-xs text-text-muted">
                  {audit.actor?.name ?? "System"} · {new Date(audit.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChangeDialog contractId={contract.id} open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`:

```tsx
"use client";

import { ContractDetail } from "@/components/financial/contracts/contract-detail";

export default function ContractDetailPage({
  params,
}: {
  params: { contractId: string };
}) {
  return <ContractDetail contractId={params.contractId} />;
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-contracts-ui.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean. Fix any unused imports flagged by strict mode before
committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/financial/contracts/contract-list.tsx src/components/financial/contracts/contract-search-filters.tsx src/components/financial/contracts/pagination.tsx src/components/financial/contracts/csv-export-button.tsx src/components/financial/contracts/contract-form.tsx src/components/financial/contracts/contract-detail.tsx src/components/financial/contracts/lifecycle-actions.tsx src/components/financial/contracts/change-dialog.tsx "src/app/(authenticated)/financial/contracts/page.tsx" "src/app/(authenticated)/financial/contracts/new/page.tsx" "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx" src/__tests__/financial-contracts-ui.test.ts
git commit -m "feat(financial): add contracts UI"
```

---

### Task 15: Add Receivables UI

**Files:**
- Create: `src/components/financial/receivables/receivables-list.tsx`
- Create: `src/components/financial/receivables/installment-actions.tsx`
- Create: `src/app/(authenticated)/financial/receivables/page.tsx`
- Create: `src/__tests__/financial-receivables-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-receivables-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("receivables UI", () => {
  it("keeps the receivables route present", () => {
    expect(exists("src/app/(authenticated)/financial/receivables/page.tsx")).toBe(true);
  });

  it("lists installments with status filters and CSV export", () => {
    const list = read("src/components/financial/receivables/receivables-list.tsx");
    expect(list).toContain("pending");
    expect(list).toContain("paid");
    expect(list).toContain("overdue");
    expect(list).toContain("cancelled");
    expect(list).toContain("exportReceivablesCsv");
  });

  it("supports paying, cancelling and refunding installments", () => {
    const actions = read("src/components/financial/receivables/installment-actions.tsx");
    expect(actions).toContain("useMarkInstallmentPaid");
    expect(actions).toContain("useCancelInstallment");
    expect(actions).toContain("useRefundInstallment");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-receivables-ui.test.ts
```

Expected: FAIL — the components and page do not exist.

- [ ] **Step 3: Create the installment actions component**

Create `src/components/financial/receivables/installment-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  useCancelInstallment,
  useMarkInstallmentPaid,
  useRefundInstallment,
} from "@/hooks/use-installments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InstallmentActions({
  installment,
}: {
  installment: {
    id: string;
    status: string;
    expectedAmount: string;
    dueDate: string;
  };
}) {
  const markPaid = useMarkInstallmentPaid();
  const cancel = useCancelInstallment();
  const refund = useRefundInstallment();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState("");

  if (installment.status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            markPaid.mutate({
              id: installment.id,
              paidAt: new Date().toISOString().slice(0, 10),
            })
          }
        >
          Mark paid
        </Button>
        <Button size="sm" variant="outline" onClick={() => cancel.mutate(installment.id)}>
          Cancel
        </Button>
      </div>
    );
  }

  if (installment.status === "paid") {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
          Refund
        </Button>
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record refund</DialogTitle>
              <DialogDescription>
                The refund creates a negative paid installment linked to the
                original one and subtracts from received revenue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm text-text-secondary">
                Refund amount (BRL)
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-text-secondary">
                Refund date
                <input
                  type="date"
                  value={refundDate}
                  onChange={(event) => setRefundDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>
                Close
              </Button>
              <Button
                disabled={!refundAmount || !refundDate}
                onClick={() =>
                  refund.mutate(
                    {
                      id: installment.id,
                      refundAmount,
                      refundDate,
                    },
                    { onSuccess: () => setRefundOpen(false) }
                  )
                }
              >
                Confirm refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
```

- [ ] **Step 4: Create the receivables list and page**

Create `src/components/financial/receivables/receivables-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";
import { exportReceivablesCsv } from "@/hooks/use-financial-exports";
import { useProjects } from "@/hooks/use-projects";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { InstallmentActions } from "@/components/financial/receivables/installment-actions";
import { LoadingState } from "@/components/shared/loading-state";
import type { Paginated } from "@/lib/financial/types";

interface ReceivableRow {
  id: string;
  expectedAmount: string;
  dueDate: string;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  refundOfId: string | null;
  contract: {
    id: string;
    code: string;
    title: string;
    client: { name: string };
  };
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export function ReceivablesList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<Paginated<ReceivableRow>>({
    queryKey: ["receivables", { status, page, projectId }],
    queryFn: () =>
      fetchJson<Paginated<ReceivableRow>>(
        `/api/receivables${qs({ status, page, pageSize, projectId })}`
      ),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load receivables" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  status === tab.value
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {projects && projects.length > 0 && (
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <CsvExportButton
          label="Export CSV"
          onExport={() => exportReceivablesCsv({ status, projectId })}
        />
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No installments match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Receivables</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Contract</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                <th scope="col" className="px-3 py-2 font-medium">Due date</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((installment) => (
                <tr key={installment.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${installment.contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {installment.contract.title}
                    </Link>
                    <p className="font-mono text-xs text-text-muted">{installment.contract.code}</p>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{installment.contract.client.name}</td>
                  <td className="px-3 py-2 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-2"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-2">
                    <InstallmentActions installment={installment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

Note: this list reads `/api/receivables`, which does not exist yet. Add it now
as a thin GET adapter in the same task:

Create `src/app/api/receivables/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { todayCivilDate } from "@/lib/financial/civil-date";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "";
  const projectId = searchParams.get("projectId") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );

  const today = todayCivilDate();
  const where = {
    ...(projectId ? { contract: { projects: { some: { projectId } } } } : {}),
    ...(status === "overdue"
      ? { status: "pending", dueDate: { lt: today } }
      : status
        ? { status }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.installment.findMany({
      where,
      include: {
        contract: {
          include: { client: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.installment.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    error: null,
  });
}
```

Create `src/app/(authenticated)/financial/receivables/page.tsx`:

```tsx
"use client";

import { ReceivablesList } from "@/components/financial/receivables/receivables-list";

export default function FinancialReceivablesPage() {
  return <ReceivablesList />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-receivables-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/financial/receivables/receivables-list.tsx src/components/financial/receivables/installment-actions.tsx src/app/api/receivables/route.ts "src/app/(authenticated)/financial/receivables/page.tsx" src/__tests__/financial-receivables-ui.test.ts
git commit -m "feat(financial): add receivables UI"
```

---

### Task 16: Add Clients UI

**Files:**
- Create: `src/components/financial/clients/client-list.tsx`
- Create: `src/components/financial/clients/client-form.tsx`
- Create: `src/components/financial/clients/client-detail.tsx`
- Create: `src/app/(authenticated)/financial/clients/page.tsx`
- Create: `src/app/(authenticated)/financial/clients/new/page.tsx`
- Create: `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`
- Create: `src/__tests__/financial-clients-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-clients-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("clients UI", () => {
  it("keeps the clients routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/clients/page.tsx",
      "src/app/(authenticated)/financial/clients/new/page.tsx",
      "src/app/(authenticated)/financial/clients/[clientId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("lists clients with search and pagination", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("useClients");
    expect(list).toContain("search");
    expect(list).toContain("Pagination");
  });

  it("consolidates contract and revenue history on the detail", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("contracts");
    expect(detail).toContain("Contract and revenue history");
  });

  it("deactivates instead of deleting clients", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("useDeactivateClient");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-clients-ui.test.ts
```

Expected: FAIL — the components and pages do not exist.

- [ ] **Step 3: Create the client list and page**

Create `src/components/financial/clients/client-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ClientList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useClients({
    search: query || undefined,
    page,
    pageSize: 25,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load clients" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="client-search" className="sr-only">
            Search clients
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setQuery(search.trim());
                setPage(1);
              }
            }}
            placeholder="Search by name, email or CPF/CNPJ"
            className="w-64 rounded-md border border-border bg-page-alt px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setQuery(search.trim());
              setPage(1);
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
            aria-label="Search clients"
          >
            <Search size={16} aria-hidden="true" />
          </button>
        </div>
        <Link
          href="/financial/clients/new"
          className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} aria-hidden="true" /> New client
        </Link>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No clients match your search" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">CPF/CNPJ</th>
                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                <th scope="col" className="px-3 py-2 font-medium">Phone</th>
                <th scope="col" className="px-3 py-2 font-medium">Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((client) => (
                <tr key={client.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/clients/${client.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{client.cpfCnpj ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client.email ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client._count?.contracts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/clients/page.tsx`:

```tsx
"use client";

import { ClientList } from "@/components/financial/clients/client-list";

export default function FinancialClientsPage() {
  return <ClientList />;
}
```

- [ ] **Step 4: Create the client form and new page**

Create `src/components/financial/clients/client-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientForm({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (clientId) {
      updateClient.mutate(
        {
          id: clientId,
          name: name || undefined,
          legalName: legalName || undefined,
          cpfCnpj: cpfCnpj || undefined,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
        },
        { onSuccess: () => router.push(`/financial/clients/${clientId}`) }
      );
      return;
    }
    createClient.mutate(
      {
        name,
        legalName: legalName || undefined,
        cpfCnpj: cpfCnpj || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: (client) => {
          toastSuccess("Client created");
          router.push(`/financial/clients/${(client as { id: string }).id}`);
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-4 rounded-xl border border-border bg-page-alt p-4">
        <div>
          <Label htmlFor="client-name">Name</Label>
          <Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-legal">Legal name</Label>
          <Input id="client-legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-doc">CPF/CNPJ</Label>
          <Input id="client-doc" value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-email">Email</Label>
          <Input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-phone">Phone</Label>
          <Input id="client-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-notes">Notes</Label>
          <textarea
            id="client-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
          />
        </div>
      </div>
      <Button disabled={!name.trim()} onClick={submit}>
        {clientId ? "Save changes" : "Create client"}
      </Button>
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/clients/new/page.tsx`:

```tsx
"use client";

import { ClientForm } from "@/components/financial/clients/client-form";

export default function NewClientPage() {
  return <ClientForm />;
}
```

- [ ] **Step 5: Create the client detail and route page**

Create `src/components/financial/clients/client-detail.tsx`:

```tsx
"use client";

import { useClient } from "@/hooks/use-clients";
import { useDeactivateClient } from "@/hooks/use-clients";
import { toDecimal, sum } from "@/lib/financial/money";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

interface ClientContract {
  id: string;
  code: string;
  title: string;
  status: string;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  _count?: { projects: number };
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const { data: client, isLoading, isError, refetch } = useClient(clientId);
  const deactivate = useDeactivateClient();

  if (isLoading) return <LoadingState />;
  if (isError || !client) {
    return <FinancialErrorState message="Failed to load the client" onRetry={() => refetch()} />;
  }

  const contracts = (client.contracts ?? []) as ClientContract[];
  const revenue = sum(
    contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => toDecimal(contract.officialValue))
  );
  const activeProjects = contracts.reduce(
    (acc, contract) => acc + (contract._count?.projects ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{client.name}</h1>
          {client.legalName && (
            <p className="text-sm text-text-secondary">{client.legalName}</p>
          )}
          <p className="mt-1 text-sm text-text-muted">
            {client.cpfCnpj ?? "—"} · {client.email ?? "—"} · {client.phone ?? "—"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => deactivate.mutate(client.id)}
          disabled={!client.active}
        >
          {client.active ? "Deactivate" : "Inactive"}
        </Button>
      </div>

      <section aria-labelledby="client-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Contracts</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{contracts.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Active contracted value</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            <MoneyText value={revenue.toFixed(2)} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Linked projects</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{activeProjects}</p>
        </div>
      </section>

      <section aria-labelledby="client-history" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="client-history" className="mb-3 text-base font-semibold text-text-primary">
          Contract and revenue history
        </h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-text-muted">No contracts recorded for this client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Code</th>
                  <th scope="col" className="px-3 py-1 font-medium">Title</th>
                  <th scope="col" className="px-3 py-1 font-medium">Status</th>
                  <th scope="col" className="px-3 py-1 font-medium">Official value</th>
                  <th scope="col" className="px-3 py-1 font-medium">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-3 py-1 font-mono text-xs text-text-secondary">{contract.code}</td>
                    <td className="px-3 py-1 font-medium">{contract.title}</td>
                    <td className="px-3 py-1"><StatusBadge status={contract.status} /></td>
                    <td className="px-3 py-1 font-medium"><MoneyText value={contract.officialValue} /></td>
                    <td className="px-3 py-1 text-text-secondary">
                      <CivilDateText date={contract.startDate} /> — <CivilDateText date={contract.endDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`:

```tsx
"use client";

import { ClientDetail } from "@/components/financial/clients/client-detail";

export default function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  return <ClientDetail clientId={params.clientId} />;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-clients-ui.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/financial/clients/client-list.tsx src/components/financial/clients/client-form.tsx src/components/financial/clients/client-detail.tsx "src/app/(authenticated)/financial/clients/page.tsx" "src/app/(authenticated)/financial/clients/new/page.tsx" "src/app/(authenticated)/financial/clients/[clientId]/page.tsx" src/__tests__/financial-clients-ui.test.ts
git commit -m "feat(financial): add clients UI"
```

---

### Task 17: Add Responsive and Accessible States

**Files:**
- Modify: `src/components/financial/overview/overview-page.tsx`
- Modify: `src/components/financial/contracts/contract-list.tsx`
- Modify: `src/components/financial/receivables/receivables-list.tsx`
- Modify: `src/components/financial/clients/client-list.tsx`
- Modify: `src/components/financial/shared/kpi-card.tsx`
- Create: `src/__tests__/financial-responsiveness.test.ts`

- [ ] **Step 1: Write the failing responsiveness contract test**

Create `src/__tests__/financial-responsiveness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial responsiveness and accessibility", () => {
  it("wraps tables in horizontal scroll containers", () => {
    for (const file of [
      "src/components/financial/contracts/contract-list.tsx",
      "src/components/financial/receivables/receivables-list.tsx",
      "src/components/financial/clients/client-list.tsx",
      "src/components/financial/contracts/contract-detail.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("overflow-x-auto");
      expect(source).toContain("min-w-[");
    }
  });

  it("uses responsive KPI grids that collapse on mobile", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("grid-cols-1");
    expect(overview).toContain("sm:grid-cols-2");
    expect(overview).toContain("xl:grid-cols-4");
  });

  it("labels every filter input and search field", () => {
    const filters = read("src/components/financial/overview/financial-filters.tsx");
    expect(filters).toContain("<label");
    const search = read("src/components/financial/contracts/contract-search-filters.tsx");
    expect(search).toContain('htmlFor="contract-search"');
  });

  it("keeps 44px minimum touch targets on controls", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain("min-h-[44px]");
    const csv = read("src/components/financial/contracts/csv-export-button.tsx");
    expect(csv).toContain("min-h-[44px]");
  });

  it("associates semantic labels and announces list state", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("scope=\"col\"");
    expect(list).toContain("<caption");
    const pagination = read("src/components/financial/contracts/pagination.tsx");
    expect(pagination).toContain("aria-live");
    expect(pagination).toContain('aria-label="Previous page"');
  });

  it("renders loading, empty, error and validation feedback states", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("LoadingState");
    expect(overview).toContain("FinancialEmptyState");
    expect(overview).toContain("FinancialErrorState");
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("role=\"alert\"");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-responsiveness.test.ts
```

Expected: FAIL — several components are missing the required classes and
semantics.

- [ ] **Step 3: Harden the KPI card with visible focus and progress sizing**

In `src/components/financial/shared/kpi-card.tsx`, change the outer div to
accept an `id` and keep the grid classes in the caller. Add an `aria-live`
region wrapper in `overview-page.tsx` around the KPI grid:

```tsx
<div
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
  aria-live="polite"
  aria-label="Financial key performance indicators"
>
```

- [ ] **Step 4: Add global filter wiring to the overview page**

In `src/components/financial/overview/overview-page.tsx`, re-add the
`useProjects` and `useClients` queries (removed in Task 13) and add client,
project, contract-status and installment-status selects below
`FinancialFilters`:

```tsx
import { useProjects } from "@/hooks/use-projects";
import { useClients } from "@/hooks/use-clients";
```

Inside `OverviewPage`, after the `useOverview(filters)` call, add:

```tsx
  const { data: projects } = useProjects();
  const { data: clientsData } = useClients({ pageSize: 100 });
```

Then render the global filter selects below `FinancialFilters`:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-text-secondary">
          Client
          <select
            value={filters.clientId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clientsData?.items.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Project
          <select
            value={filters.projectId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All projects</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Contract status
          <select
            value={filters.contractStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, contractStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {["draft", "active", "closed", "cancelled", "suspended"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Installment status
          <select
            value={filters.installmentStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, installmentStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All installments</option>
            {["pending", "paid", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
```

This makes the global filters affect the KPIs, chart and lists together, as
the spec requires.

- [ ] **Step 5: Add focus-visible rings and empty search handling**

In `src/components/financial/contracts/contract-search-filters.tsx`, add
`focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none` to
the search input and selects. In `contract-list.tsx`, when the server returns
zero rows for a non-empty search, keep the empty state but also surface a hint
matching the search term.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-responsiveness.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the full financial suite and typecheck**

```bash
npx vitest run src/__tests__/financial-schema.test.ts src/__tests__/financial-money.test.ts src/__tests__/financial-installments.test.ts src/__tests__/financial-metrics.test.ts src/__tests__/financial-lifecycle.test.ts src/__tests__/financial-services.test.ts src/__tests__/financial-clients-api.test.ts src/__tests__/financial-contracts-api.test.ts src/__tests__/financial-operations-api.test.ts src/__tests__/financial-overview-api.test.ts src/__tests__/financial-exports.test.ts src/__tests__/financial-hooks.test.ts src/__tests__/financial-overview-ui.test.ts src/__tests__/financial-contracts-ui.test.ts src/__tests__/financial-receivables-ui.test.ts src/__tests__/financial-clients-ui.test.ts src/__tests__/financial-responsiveness.test.ts
npx tsc --noEmit --incremental false
```

Expected: all PASS and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/financial/overview/overview-page.tsx src/components/financial/contracts/contract-list.tsx src/components/financial/receivables/receivables-list.tsx src/components/financial/clients/client-list.tsx src/components/financial/shared/kpi-card.tsx src/__tests__/financial-responsiveness.test.ts
git commit -m "feat(financial): add responsive and accessible states"
```

---

### Task 18: Run Final Verification Gates

**Files:**
- Modify: only files with defects found by the gates.

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
```

Expected: all tests pass, including every pre-existing story and regression
test.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any lint findings before continuing.

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 4: Validate the Prisma schema**

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

Expected: schema formatted, valid and client regenerated.

- [ ] **Step 5: Run the production build**

```bash
npm run build
```

Expected: production build succeeds with the new financial routes.

- [ ] **Step 6: Check for whitespace and conflict markers**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Run the final integrated review**

Review the complete `git diff` end-to-end against the design spec and the
tasks, covering schema, services, controllers, hooks, UI and tests. Confirm
the scope contains only financial-module files plus any defect fixes. The
integrated review must be `APPROVED` before proceeding.

- [ ] **Step 8: Commit pending changes, push and open the single PR**

Under the continuous authorization granted at the start of the plan, commit
any pending changes (including any `fix(financial): ...` defect fixes), push
the branch, and open exactly one pull request after the gates above are green
and the integrated review is approved:

```bash
git add -A
git commit -m "feat(financial): complete financial module"
git push origin feat/financial-module
gh pr create --base main --head feat/financial-module \
  --title "feat(financial): financial module" \
  --body "Implements the financial module. All verification gates green and integrated review approved."
```

Expected: exactly one commit lands, the branch is pushed, and a single PR
targeting `main` is created.

---

## Self-Review

- **Spec coverage:** Schema/migration (Task 1), decimal money and civil dates
  (Task 2), equal installments, rounding remainder, exact sums and recurring
  horizon (Tasks 3 and 6), MRR/ARR for every frequency and all metric
  grouping rules (Task 4), lifecycle, cancellation, renewal and
  one-active-contract-per-project (Tasks 5 and 6), before/after financial
  audit (Task 5), clients, contracts, lifecycle, changes, installments,
  overview and CSV APIs (Tasks 7–11), React Query hooks (Task 12), Overview,
  Contracts, Receivables and Clients UI (Tasks 13–16), responsive and
  accessible states plus loading/empty/error/validation feedback (Task 17),
  and the boolean gates (Task 18). Out-of-scope items (DRE, partial payments,
  CSV import, multi-currency, catalogs, financial roles, PDF reports) are not
  planned.
- **Placeholder scan:** no TBD/TODO/"implement later"/"similar to" text; every
  code step shows complete concrete code.
- **Type consistency:** `Money` = `Prisma.Decimal`; `InstallmentPlanItem`,
  `ContractStatus`, `DurationType`, `BillingFrequency`, `PaymentMethod`,
  `ChangeType`, `LifecycleAction`, `Paginated<T>` and `OverviewFilters` are
  defined once in `src/lib/financial/types.ts` and reused by the services,
  routes, hooks and UI. Function names (`activateContract`,
  `applyLifecycleAction`, `applyContractChange`, `recordPayment`,
  `refundInstallment`, `extendRecurringHorizons`, `computeOverview`) match
  across test contracts, services and API adapters.
