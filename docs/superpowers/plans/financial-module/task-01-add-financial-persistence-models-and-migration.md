# Financial Module — Task 1

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

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

const MODELS = [
  "Client",
  "Contract",
  "ContractItem",
  "ContractProject",
  "Installment",
  "ContractChange",
  "ContractAudit",
];

const TABLES = [
  "clients",
  "contracts",
  "contract_items",
  "contract_projects",
  "installments",
  "contract_changes",
  "contract_audits",
];

function modelBody(model: string): string {
  const match = schema.match(
    new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`)
  );
  if (!match) throw new Error(`model ${model} not found`);
  return match[1];
}

function fieldOf(body: string, name: string): string {
  const match = body.match(
    new RegExp(`^\\s*${name}\\s+([^\\s]+)\\s*([^\\n]*)`, "m")
  );
  if (!match) throw new Error(`field ${name} not found`);
  return `${name} ${match[1]} ${match[2]}`.trim();
}

function tableBody(table: string): string {
  const match = migration.match(
    new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`)
  );
  if (!match) throw new Error(`table ${table} not found`);
  return match[1];
}

function columnOf(body: string, column: string): string {
  const match = body.match(new RegExp(`^\\s*"${column}"([^\\n]*)`, "m"));
  if (!match) throw new Error(`column ${column} not found`);
  return `"${column}"${match[1]}`.trim();
}

describe("financial module schema", () => {
  it.each(MODELS)("defines %s", (model) => {
    expect(modelBody(model)).toBeTruthy();
  });

  it("stores money as decimal and dates as civil strings", () => {
    expect(schema).toContain("@db.Decimal(14, 2)");
    expect(fieldOf(modelBody("Contract"), "startDate")).toContain(
      '@map("start_date")'
    );
    expect(fieldOf(modelBody("Installment"), "dueDate")).toContain(
      '@map("due_date")'
    );
  });

  it("keeps the contract code unique and the client cpf/cnpj unique", () => {
    const code = fieldOf(modelBody("Contract"), "code");
    expect(code).toMatch(/^code\s+String/);
    expect(code).toContain("@unique");
    expect(modelBody("Client")).toContain("@@unique([cpfCnpj])");
  });

  it("allows incomplete contract drafts without breaking the required code", () => {
    const contract = modelBody("Contract");
    expect(fieldOf(contract, "code")).toContain("@unique");
    expect(fieldOf(contract, "code")).not.toContain("?");
    for (const nullable of [
      "title",
      "clientId",
      "durationType",
      "startDate",
    ]) {
      expect(fieldOf(contract, nullable)).toContain("String?");
    }
    expect(fieldOf(contract, "officialValue")).toContain("Decimal?");
    expect(fieldOf(contract, "client")).toContain("Client?");

    const contracts = tableBody("contracts");
    expect(columnOf(contracts, "code")).toContain("NOT NULL");
    for (const nullable of [
      "title",
      "client_id",
      "duration_type",
      "official_value",
      "start_date",
    ]) {
      expect(columnOf(contracts, nullable)).not.toContain("NOT NULL");
    }
  });

  it("guards against duplicate recurring installments per cycle", () => {
    expect(modelBody("Installment")).toContain("@@unique([contractId, cycleKey])");
  });

  it("keeps refunds linked to the original installment", () => {
    const installment = modelBody("Installment");
    expect(fieldOf(installment, "refundOfId")).toContain("String?");
    expect(fieldOf(installment, "refunds")).toContain(
      '@relation("InstallmentRefund")'
    );
  });

  it("creates all tables in a single additive migration", () => {
    for (const table of TABLES) {
      expect(tableBody(table)).toBeTruthy();
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
  title            String?
  clientId         String?  @map("client_id")
  ownerId          String?  @map("owner_id")
  status           String   @default("draft")
  durationType     String?  @map("duration_type")
  officialValue    Decimal? @map("official_value") @db.Decimal(14, 2)
  startDate        String?  @map("start_date")
  endDate          String?  @map("end_date")
  billingFrequency String?  @map("billing_frequency")
  paymentMethod    String   @default("pix") @map("payment_method")
  documentUrl      String?  @map("document_url")
  notes            String?
  predecessorId    String?  @map("predecessor_id")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  client       Client?           @relation(fields: [clientId], references: [id], onDelete: Restrict)
  owner        Profile?          @relation("ContractOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  items        ContractItem[]
  projects     ContractProject[]
  installments Installment[]
  changes      ContractChange[]
  audits       ContractAudit[]
  predecessor  Contract?         @relation("ContractRenewal", fields: [predecessorId], references: [id], onDelete: SetNull)
  successors   Contract[]        @relation("ContractRenewal")

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
    "title" TEXT,
    "client_id" TEXT,
    "owner_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration_type" TEXT,
    "official_value" DECIMAL(14,2),
    "start_date" TEXT,
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

