import type { Prisma } from "@prisma/client";
import { requireTenantId } from "../../../prisma/client";
import type { RecordActivityInput } from "./types";

interface RecordActivityResult {
  activityId: string;
  notifiedProfileIds: string[];
}

export async function recordActivity(
  tx: Prisma.TransactionClient,
  input: RecordActivityInput
): Promise<RecordActivityResult> {
  const activity = await tx.activity.create({
    data: {
      actorId: input.actorId ?? null,
      taskId: input.taskId ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
      tenantId: requireTenantId("activity.record"),
    },
  });

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
        activityId: activity.id,
        tenantId: requireTenantId("activity.record"),
      })),
      skipDuplicates: true,
    });
  }

  return {
    activityId: activity.id,
    notifiedProfileIds: recipients,
  };
}
