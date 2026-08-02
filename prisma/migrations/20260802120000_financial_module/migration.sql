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
