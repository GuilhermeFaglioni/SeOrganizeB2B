"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("layout.pageTitles");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const pageMeta =
    pathname === "/app"
      ? { title: t("today"), action: t("actions.today") }
      : pathname.startsWith("/documents")
      ? { title: t("documents"), action: t("actions.documents") }
      : pathname.startsWith("/calendar")
        ? { title: t("calendar"), action: t("actions.calendar") }
        : pathname.startsWith("/projects")
          ? { title: t("projects"), action: t("actions.projects") }
          : pathname.startsWith("/plans")
            ? { title: t("plans"), action: null }
            : pathname.startsWith("/settings")
              ? { title: t("settings"), action: null }
              : pathname.startsWith("/upgrade")
                ? { title: t("upgrade"), action: null }
                : pathname.startsWith("/all")
                  ? { title: t("all"), action: t("actions.all") }
                  : { title: t("board"), action: t("actions.board") };

  const handleNewClick = async () => {
    if (pathname === "/app" || pathname.startsWith("/board")) {
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
