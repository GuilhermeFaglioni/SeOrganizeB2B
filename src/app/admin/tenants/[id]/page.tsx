"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminTenantDetailPage() {
  const t = useTranslations("admin.pages.tenantDetail");

  return (
    <AdminPagePlaceholder
      testId="admin-tenant-detail-page"
      icon={Building2}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
