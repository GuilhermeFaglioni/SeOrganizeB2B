-- Idempotency for one-shot notification activities: a given proposal or
-- installment may produce at most one notification activity of each type.
-- The partial index scopes uniquess to the notification types only, so other
-- activity types (e.g. repeated comments/updates on the same entity) are
-- unaffected.
CREATE UNIQUE INDEX "activities_notification_dedupe"
  ON "activities" ("type", "entity_id")
  WHERE "type" IN (
    'installment.due_tomorrow',
    'installment.overdue',
    'proposal.viewed',
    'proposal.accepted',
    'proposal.rejected'
  );
