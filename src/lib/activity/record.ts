import type { Prisma } from "@prisma/client";
import { requireTenantId } from "../../../prisma/client";
import type { RecordActivityInput } from "./types";

interface RecordActivityResult {
  activityId: string;
  notifiedProfileIds: string[];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function recordActivity(
  tx: Prisma.TransactionClient,
  input: RecordActivityInput
): Promise<RecordActivityResult> {
  const tenantId = input.tenantId ?? requireTenantId("activity.record");

  let activityId: string;
  try {
    const activity = await tx.activity.create({
      data: {
        actorId: input.actorId ?? null,
        taskId: input.taskId ?? null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata,
        tenantId,
      },
    });
    activityId = activity.id;
  } catch (error) {
    // One-shot notification activities are deduped by a partial unique index
    // on activities(type, entity_id). A duplicate insert means the notification
    // was already recorded — skip silently (idempotent).
    if (isUniqueViolation(error)) {
      return { activityId: "", notifiedProfileIds: [] };
    }
    throw error;
  }

  const recipients = Array.from(
    new Set(
      (input.notifyProfileIds ?? []).filter(
        (profileId) => profileId && profileId !== input.actorId
      )
    )
  );
  if (recipients.length > 0) {
    await tx.notification.createMany({
      data: recipients.map((recipientId) => ({
        recipientId,
        activityId,
        tenantId,
      })),
      skipDuplicates: true,
    });
  }

  return {
    activityId,
    notifiedProfileIds: recipients,
  };
}
