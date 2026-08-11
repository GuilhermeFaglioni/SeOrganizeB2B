"use client";

import { useTranslations } from "next-intl";
import { LifeBuoy } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminSupportPage() {
  const t = useTranslations("admin.pages.support");

  return (
    <AdminPagePlaceholder
      testId="admin-support-page"
      icon={LifeBuoy}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
