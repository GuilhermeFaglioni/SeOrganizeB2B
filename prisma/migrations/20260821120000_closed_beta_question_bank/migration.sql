-- Closed Beta question bank: reusable question templates that admins can
-- compose into check-in editions. Edition questions remain durable snapshots,
-- so editing or archiving a bank item never mutates published editions.

CREATE TABLE "closed_beta_question_bank" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT,
    "is_suggestion_question" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_question_bank_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "closed_beta_question_bank_status_idx"
ON "closed_beta_question_bank"("status");
CREATE INDEX "closed_beta_question_bank_theme_idx"
ON "closed_beta_question_bank"("theme");
