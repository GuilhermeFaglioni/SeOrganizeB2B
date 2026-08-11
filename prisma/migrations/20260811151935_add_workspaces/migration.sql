-- DropIndex
DROP INDEX "proposal_templates_created_by_idx";

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "company_name" TEXT,
    "default_role_id" TEXT,
    "stripe_customer_id" TEXT,
    "plan_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grace_period_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "proposal_templates_created_by_idx" ON "proposal_templates"("created_by");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
