"use client";

import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function PushNotificationToggle() {
  const t = useTranslations("notifications.push");
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    requestPermission,
  } = usePushNotifications();

  if (!isSupported) return null;

  const handleClick = async () => {
    if (permission !== "granted") {
      await requestPermission();
      if (Notification.permission === "granted") {
        await subscribe();
      }
    } else if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const getIcon = () => {
    if (permission === "denied") return <BellOff className="h-4 w-4" />;
    if (isSubscribed) return <BellRing className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (permission === "denied") return t("blocked");
    if (isSubscribed) return t("disable");
    return t("enable");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isLoading || permission === "denied"}
      className="gap-2"
      aria-label={getLabel()}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </Button>
  );
}
