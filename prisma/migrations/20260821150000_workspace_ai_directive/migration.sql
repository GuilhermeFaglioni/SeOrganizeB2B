-- AI Studio: workspace-level template directive.
--
-- A workspace holds at most one active text directive (unique on tenant_id).
-- The directive carries updated_by/updated_at so directive changes are
-- traceable. Content is plain guidance text, never executed or sanitized HTML;
-- it is passed to providers as untrusted context. Full history is out of scope.

CREATE TABLE "workspace_directives" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_directives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_directives_tenant_id_key"
ON "workspace_directives"("tenant_id");

ALTER TABLE "workspace_directives"
ADD CONSTRAINT "workspace_directives_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_directives"
ADD CONSTRAINT "workspace_directives_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
