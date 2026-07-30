"use client";

import { useEffect, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import type { AppToastDetail } from "@/lib/toast";

interface ToastItem extends AppToastDetail {
  id: string;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

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

  return (
    <ToastProvider swipeDirection="right">
      {items.map((item) => (
        <Toast
          key={item.id}
          defaultOpen
          duration={5_000}
          role={item.type === "error" ? "alert" : "status"}
          variant={
            item.type === "error"
              ? "destructive"
              : item.type === "success"
                ? "success"
                : "default"
          }
          onOpenChange={(open) => {
            if (!open) {
              setItems((current) =>
                current.filter((toast) => toast.id !== item.id),
              );
            }
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{item.message}</ToastTitle>
            {item.description && (
              <ToastDescription>{item.description}</ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport aria-live="polite" />
    </ToastProvider>
  );
}
