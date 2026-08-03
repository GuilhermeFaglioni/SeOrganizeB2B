-- Proposal templates and personalized proposals for clients.
-- Templates hold sanitized HTML with {{variable}} placeholders; proposals
-- freeze a rendered snapshot when sent and expose a public tokenized link.

CREATE TABLE "proposal_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_templates_created_by_idx" ON "proposal_templates"("created_by");

CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "template_id" TEXT,
    "created_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "html_snapshot" TEXT NOT NULL DEFAULT '',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "total_value" DECIMAL(14,2),
    "issue_date" TEXT,
    "valid_until" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "viewed_at" TEXT,
    "accepted_at" TEXT,
    "accepted_by_name" TEXT,
    "rejected_at" TEXT,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposals_code_key" ON "proposals"("code");
CREATE UNIQUE INDEX "proposals_token_key" ON "proposals"("token");
CREATE INDEX "proposals_client_id_idx" ON "proposals"("client_id");
CREATE INDEX "proposals_created_by_idx" ON "proposals"("created_by");
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

CREATE TABLE "proposal_items" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,4),
    "price" DECIMAL(14,2),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proposal_items_proposal_id_idx" ON "proposal_items"("proposal_id");

CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "company_name" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_fkey"
    FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
