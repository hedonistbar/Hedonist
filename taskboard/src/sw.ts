/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

type PushPayload = { title?: string; body?: string; tag?: string; url?: string };

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Taskboard", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Taskboard", {
      body: payload.body,
      tag: payload.tag,
      icon: "/Hedonist/taskboard/icons/icon-192.png",
      badge: "/Hedonist/taskboard/icons/icon-192.png",
      data: { url: payload.url ?? "/Hedonist/taskboard/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/Hedonist/taskboard/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/taskboard/") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
