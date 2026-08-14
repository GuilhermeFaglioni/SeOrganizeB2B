-- Persist the workspace-level onboarding completion so completed workspaces do
-- not need to load all onboarding source data on every home visit.
ALTER TABLE "workspaces"
ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill workspaces that already satisfy the onboarding requirements.
UPDATE "workspaces" AS w
SET "onboarding_completed" = true
WHERE trim(coalesce(w."company_name", '')) <> ''
  AND EXISTS (
    SELECT 1
    FROM "clients" AS c
    WHERE c."tenant_id" = w."id"
      AND c."active" = true
  )
  AND (
    EXISTS (
      SELECT 1
      FROM "proposals" AS p
      WHERE p."tenant_id" = w."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "contracts" AS c
      WHERE c."tenant_id" = w."id"
    )
  )
  AND EXISTS (
    SELECT 1
    FROM "projects" AS p
    INNER JOIN "tasks" AS t ON t."project_id" = p."id"
    WHERE p."tenant_id" = w."id"
      AND p."archived" = false
  );
