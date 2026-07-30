"use client";

export const dynamic = "force-dynamic";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/stores/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/toaster";
import { NotificationToastWatcher } from "@/components/notifications/notification-toast-watcher";
import { ScheduleEventProvider } from "@/stores/schedule-event-context";
import { QuickCaptureProvider } from "@/stores/quick-capture-context";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <ScheduleEventProvider>
            <QuickCaptureProvider>
              <AppLayout>{children}</AppLayout>
            </QuickCaptureProvider>
          </ScheduleEventProvider>
          <NotificationToastWatcher />
          <Toaster />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
