-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "tenant_id" TEXT;

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
