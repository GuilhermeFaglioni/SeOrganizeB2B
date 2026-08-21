"use client";

import { useEffect, useState } from "react";
import { ToastViewport, type ToastItem as BalsaToastItem } from "@/components/ui/ToastViewport";
import type { AppToastDetail } from "@/lib/toast";

interface AppToastItem extends AppToastDetail {
  id: string;
}

export function Toaster() {
  const [items, setItems] = useState<AppToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<AppToastDetail>).detail;
      setItems((current) => [
        ...current.slice(-3),
        {
          ...detail,
          id: detail.id ?? crypto.randomUUID(),
        },
      ]);
    }

    window.addEventListener("app-toast", handleToast);
    return () => window.removeEventListener("app-toast", handleToast);
  }, []);

  const renderedItems: BalsaToastItem[] = items.map((item) => ({
    id: item.id,
    title: item.message,
    description: item.description,
    color: item.type === "error"
      ? "destructive"
      : item.type === "success"
        ? "success"
        : "info",
    duration: 5_000,
  }));

  return (
    <ToastViewport
      value={renderedItems}
      aria-live="polite"
      onValueChange={(next) => {
        const remaining = new Set(next.map((item) => item.id));
        setItems((current) => current.filter((item) => remaining.has(item.id)));
      }}
    />
  );
}
