-- CreateTable
CREATE TABLE "read_only_accesses" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "read_only_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "read_only_accesses_token_key" ON "read_only_accesses"("token");

-- CreateIndex
CREATE INDEX "read_only_accesses_token_idx" ON "read_only_accesses"("token");

-- AddForeignKey
ALTER TABLE "read_only_accesses" ADD CONSTRAINT "read_only_accesses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
