"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const t = useTranslations("hooks.pushNotifications");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || permission !== "granted") return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key
      const response = await fetch("/api/push/vapid-public-key");
      const { data } = await response.json();
      if (!data?.publicKey) throw new Error(t("vapidKeyNotFound"));

      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const { endpoint, keys } = subscription.toJSON();
      if (!endpoint || !keys) throw new Error(t("invalidSubscription"));

      // Register with server
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error("Failed to subscribe:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, t]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const { endpoint } = subscription.toJSON();
        await fetch("/api/push/unregister", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}
