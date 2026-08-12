"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminAccessDenied() {
  const t = useTranslations("admin.forbidden");

  return (
    <div
      data-testid="admin-access-denied"
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-page px-4 text-center"
    >
      <div className="mb-4 text-text-muted">
        <ShieldX className="h-12 w-12" aria-hidden="true" />
      </div>
      <h1 className="text-heading-1 font-semibold text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-sm text-body-small text-text-secondary">
        {t("description")}
      </p>
      <Button asChild className="mt-6">
        <Link href="/app">{t("backToApp")}</Link>
      </Button>
    </div>
  );
}
