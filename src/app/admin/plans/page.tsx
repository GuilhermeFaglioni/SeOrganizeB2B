"use client";

import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminPlansPage() {
  const t = useTranslations("admin.pages.plans");

  return (
    <AdminPagePlaceholder
      testId="admin-plans-page"
      icon={Receipt}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
