"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminTenantsPage() {
  const t = useTranslations("admin.pages.tenants");

  return (
    <AdminPagePlaceholder
      testId="admin-tenants-page"
      icon={Building2}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
