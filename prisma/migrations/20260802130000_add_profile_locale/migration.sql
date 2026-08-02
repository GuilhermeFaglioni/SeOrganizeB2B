-- Add user locale preference for internationalization.
ALTER TABLE "profiles" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'pt-BR';
