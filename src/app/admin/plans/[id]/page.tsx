"use client";

import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminPlanDetailPage() {
  const t = useTranslations("admin.pages.planDetail");

  return (
    <AdminPagePlaceholder
      testId="admin-plan-detail-page"
      icon={Receipt}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
