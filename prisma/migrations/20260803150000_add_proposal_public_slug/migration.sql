-- Friendly public proposal URLs keep the readable title while retaining a
-- random suffix so the URL cannot be guessed from the title alone.
ALTER TABLE "proposals" ADD COLUMN "public_slug" TEXT;

UPDATE "proposals"
SET "public_slug" =
  COALESCE(
    NULLIF(
      trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'proposta'
  ) || '-' || substr(replace("token", '-', ''), 1, 16);

ALTER TABLE "proposals" ALTER COLUMN "public_slug" SET NOT NULL;
CREATE UNIQUE INDEX "proposals_public_slug_key" ON "proposals"("public_slug");
