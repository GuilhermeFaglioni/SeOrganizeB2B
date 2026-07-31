import { precacheAndRoute } from "@serwist/precaching";

// __SW_MANIFEST is injected by Serwist's webpack plugin at build time.
// @ts-expect-error — defined at build time by webpack DefinePlugin
precacheAndRoute(self.__SW_MANIFEST);

// Push notification handler
self.addEventListener("push", ((event: unknown) => {
  const pushEvent = event as { data?: { json(): unknown; text(): string } };
  if (!pushEvent.data) return;

  let data;
  try {
    data = pushEvent.data.json();
  } catch {
    data = {
      title: "SeOrganize+",
      body: pushEvent.data.text(),
    };
  }

  const options = {
    body: (data as { body?: string }).body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "seorganize-notification",
    data: { url: "/" },
  };

  // @ts-expect-error — service worker registration API
  self.registration.showNotification(
    (data as { title?: string }).title || "SeOrganize+",
    options
  );
}) as EventListener);

// Notification click handler
self.addEventListener("notificationclick", ((event: unknown) => {
  const notificationEvent = event as { notification: { close(): void; data?: { url?: string } } };
  notificationEvent.notification.close();

  const url = notificationEvent.notification.data?.url || "/";

  // @ts-expect-error — service worker clients API
  self.clients.matchAll({ type: "window" }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(self.location.origin) && "focus" in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    // @ts-expect-error — service worker clients API
    return self.clients.openWindow(url);
  });
}) as EventListener);
