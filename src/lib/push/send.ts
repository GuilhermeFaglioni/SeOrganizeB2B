import webPush from "web-push";
import { prisma } from "../../../prisma/client";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:noreply@seorganize.com";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(
  profileId: string,
  payload: PushPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { profileId },
  });

  if (subscriptions.length === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    url: payload.url || "/",
    tag: payload.tag || "seorganize-notification",
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notificationPayload
      )
    )
  );

  // Remove invalid subscriptions (404 Gone or 410 Gone)
  const endpointsToRemove: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason as { statusCode?: number };
      if (error.statusCode === 404 || error.statusCode === 410) {
        endpointsToRemove.push(subscriptions[index].endpoint);
      }
    }
  });

  if (endpointsToRemove.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: endpointsToRemove } },
    });
  }
}

export async function sendPushToUsers(
  profileIds: string[],
  payload: PushPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey || profileIds.length === 0) return;

  await Promise.allSettled(
    profileIds.map((profileId) => sendPushToUser(profileId, payload))
  );
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}
