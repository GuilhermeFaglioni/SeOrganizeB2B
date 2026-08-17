CREATE TABLE "closed_beta_rate_limits" (
    "key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "closed_beta_rate_limits_blocked_until_idx"
ON "closed_beta_rate_limits"("blocked_until");
