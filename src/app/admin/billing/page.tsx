"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { AdminPagePlaceholder } from "@/components/admin/admin-page-placeholder";

export default function AdminBillingPage() {
  const t = useTranslations("admin.pages.billing");

  return (
    <AdminPagePlaceholder
      testId="admin-billing-page"
      icon={Wallet}
      title={t("title")}
      description={t("comingSoon")}
    />
  );
}
