import { prisma } from "../../../prisma/client";
import { recordActivity } from "../activity/record";
import { sendPushToUsers } from "../push";
import { addDaysCivil, todayCivilDate } from "./civil-date";
import { moneyToJson } from "./money";

export type InstallmentEventType = "installment.due_tomorrow" | "installment.overdue";

/**
 * Checks whether an Activity with the given type and entityId already exists.
 * Used for idempotency — prevents duplicate notifications on repeated calls.
 */
async function activityAlreadyExists(
  type: string,
  entityId: string
): Promise<boolean> {
  const existing = await prisma.activity.findFirst({
    where: { type, entityId },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Finds installments that are due tomorrow or overdue and creates in-app
 * notifications for the contract owner (prestador digital).
 *
 * This function is designed to be called on-demand (e.g., when the user
 * loads the Today page) rather than via a scheduler, matching the
 * "por evento, sem agendador" requirement.
 *
 * Idempotent: skips installments that already have a matching Activity
 * (same type + entityId), so repeated calls do not create duplicates.
 *
 * Returns the count of new notifications created.
 */
export async function checkAndNotifyInstallments(): Promise<{
  dueTomorrow: number;
  overdue: number;
}> {
  const today = todayCivilDate();
  const tomorrow = addDaysCivil(today, 1);

  // Find pending installments due tomorrow
  const dueTomorrowInstallments = await prisma.installment.findMany({
    where: {
      status: "pending",
      dueDate: tomorrow,
    },
    include: {
      contract: {
        select: {
          id: true,
          code: true,
          title: true,
          ownerId: true,
          tenantId: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  // Find overdue installments (pending + dueDate < today)
  const overdueInstallments = await prisma.installment.findMany({
    where: {
      status: "pending",
      dueDate: { lt: today },
    },
    include: {
      contract: {
        select: {
          id: true,
          code: true,
          title: true,
          ownerId: true,
          tenantId: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  let dueTomorrowCount = 0;
  let overdueCount = 0;

  // Process "due tomorrow" notifications
  for (const installment of dueTomorrowInstallments) {
    if (!installment.contract.ownerId) continue;
    if (await activityAlreadyExists("installment.due_tomorrow", installment.id)) continue;

    const amount = moneyToJson(installment.expectedAmount);
    const clientName = installment.contract.client?.name ?? "Cliente";
    const summary = `Parcela de R$ ${amount} do contrato ${installment.contract.code} (${clientName}) vence amanhã`;

    try {
      await prisma.$transaction(async (tx) => {
        const { notifiedProfileIds } = await recordActivity(tx, {
          actorId: null,
          type: "installment.due_tomorrow",
          entityType: "installment",
          entityId: installment.id,
          summary,
          notifyProfileIds: [installment.contract.ownerId!],
        });

        if (notifiedProfileIds.length > 0) {
          const { buildPushPayload } = await import("../push/payload");
          const pushPayload = buildPushPayload({
            activityType: "installment.due_tomorrow",
            summary,
            actorName: "Sistema",
            entityType: "installment",
            entityId: installment.id,
          });
          if (pushPayload) {
            await sendPushToUsers(notifiedProfileIds, pushPayload);
          }
        }
      });
      dueTomorrowCount++;
    } catch {
      // Notification already exists (unique constraint) or other error — skip
    }
  }

  // Process "overdue" notifications
  for (const installment of overdueInstallments) {
    if (!installment.contract.ownerId) continue;
    if (await activityAlreadyExists("installment.overdue", installment.id)) continue;

    const amount = moneyToJson(installment.expectedAmount);
    const clientName = installment.contract.client?.name ?? "Cliente";
    const summary = `Parcela de R$ ${amount} do contrato ${installment.contract.code} (${clientName}) está vencida desde ${installment.dueDate}`;

    try {
      await prisma.$transaction(async (tx) => {
        const { notifiedProfileIds } = await recordActivity(tx, {
          actorId: null,
          type: "installment.overdue",
          entityType: "installment",
          entityId: installment.id,
          summary,
          notifyProfileIds: [installment.contract.ownerId!],
        });

        if (notifiedProfileIds.length > 0) {
          const { buildPushPayload } = await import("../push/payload");
          const pushPayload = buildPushPayload({
            activityType: "installment.overdue",
            summary,
            actorName: "Sistema",
            entityType: "installment",
            entityId: installment.id,
          });
          if (pushPayload) {
            await sendPushToUsers(notifiedProfileIds, pushPayload);
          }
        }
      });
      overdueCount++;
    } catch {
      // Notification already exists (unique constraint) or other error — skip
    }
  }

  return { dueTomorrow: dueTomorrowCount, overdue: overdueCount };
}
