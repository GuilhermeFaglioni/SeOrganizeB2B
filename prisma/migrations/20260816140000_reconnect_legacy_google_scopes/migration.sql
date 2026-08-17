-- Legacy Calendar credentials were stored without an approved scope record.
-- Discard them rather than leaving plaintext tokens at rest; users must reconnect.
UPDATE "calendar_auth"
SET
  "access_token" = NULL,
  "refresh_token" = NULL,
  "expires_at" = NULL,
  "connection_status" = 'reconnect_required',
  "last_error_code" = 'GOOGLE_SCOPE_MIGRATION_REQUIRED'
WHERE "granted_scopes" IS NULL;
