ALTER TABLE "calendar_auth"
  ALTER COLUMN "access_token" DROP NOT NULL,
  ALTER COLUMN "refresh_token" DROP NOT NULL,
  ALTER COLUMN "expires_at" DROP NOT NULL;

ALTER TABLE "calendar_auth"
  ADD COLUMN "granted_scopes" TEXT,
  ADD COLUMN "connection_status" TEXT NOT NULL DEFAULT 'connected',
  ADD COLUMN "revoked_at" TIMESTAMP(3),
  ADD COLUMN "last_error_code" TEXT,
  ADD COLUMN "refresh_lease_until" TIMESTAMP(3);
