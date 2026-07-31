"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useRouter, usePathname } from "next/navigation";
import { useCreateDocument } from "@/hooks/use-documents";
import { AnimatedPage } from "@/components/shared/animated-page";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { useQuickCapture } from "@/hooks/use-quick-capture";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createDoc = useCreateDocument();
  const { openScheduleEvent } = useScheduleEventDialog();
  const { openQuickCapture } = useQuickCapture();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const pageMeta = pathname === "/"
    ? { title: "Today", action: "Capture" }
    : pathname.startsWith("/documents")
    ? { title: "Documents", action: "New document" }
    : pathname.startsWith("/calendar")
      ? { title: "Calendar", action: "New event" }
      : pathname.startsWith("/projects")
        ? { title: "Projects", action: "New project" }
        : pathname.startsWith("/settings")
          ? { title: "Settings", action: null }
          : pathname.startsWith("/all")
            ? { title: "All tasks", action: "New task" }
            : { title: "Board", action: "New task" };

  const handleNewClick = async () => {
    if (pathname === "/" || pathname.startsWith("/board")) {
      openQuickCapture();
    } else if (pathname.startsWith("/calendar")) {
      openScheduleEvent();
    } else if (pathname.startsWith("/documents")) {
      const doc = await createDoc.mutateAsync({ title: "Untitled Document" }) as { id: string };
      router.push(`/documents/${doc.id}`);
    } else if (pathname.startsWith("/board")) {
      router.push("/board");
    } else if (pathname === "/projects") {
      router.push("/projects?newProject=true");
    } else {
      router.push("/board");
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={setMobileMenuOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title ?? pageMeta.title}
          actionLabel={pageMeta.action ?? undefined}
          onNewClick={pageMeta.action ? handleNewClick : undefined}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-hidden bg-page">
          <AnimatedPage pageKey={pathname}>{children}</AnimatedPage>
        </main>
      </div>
    </div>
  );
}
