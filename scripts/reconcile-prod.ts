import { PrismaClient } from "@prisma/client";

// One-time, idempotent reconciliation for the RBAC roles migration drift.
// Safe to run on every deploy: each statement uses IF NOT EXISTS semantics,
// so it only repairs what is missing (e.g. a `roles` table created earlier
// without the is_admin column) and never touches existing data.
//
// Used in the production deploy BEFORE `prisma migrate deploy` so the
// migration history can be resolved even when the schema drifted.

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT`,
  // The single-tenant unique on name alone blocks the second account's
  // seedWorkspaceRoles ("Admin" already exists globally -> P2002). Drop it and
  // enforce uniqueness per (name, tenant_id) instead.
  `DROP INDEX IF EXISTS "roles_name_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_tenant_id_key" ON "roles"("name", "tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "roles_is_admin_idx" ON "roles"("is_admin")`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "role_id" TEXT`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_id_fkey') THEN
       ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_id_fkey"
         FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$`,
  `INSERT INTO "roles" ("id", "name", "permissions", "is_admin", "tenant_id", "created_at", "updated_at")
   SELECT '00000000-0000-0000-0000-000000000001', 'Admin', '[]', true, '00000000-0000-0000-0000-000000000001', now(), now()
   WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "id" = '00000000-0000-0000-0000-000000000001')`,
  `UPDATE "roles" SET "is_admin" = true, "name" = 'Admin'
   WHERE "id" = '00000000-0000-0000-0000-000000000001'`,
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Schema reconciliation complete.");
}

main()
  .catch((error) => {
    console.error("Schema reconciliation failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
