"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-permissions";
import { RolesManager } from "@/components/settings/roles-manager";
import { Button } from "@/components/ui/button";

export default function RolesPage() {
  const router = useRouter();
  const t = useTranslations("roles.page");
  const { can, data } = useCan();

  if (data && !can("manage_roles")) {
    return (
      <div className="p-6">
        <p className="text-sm text-text-secondary">{t("noPermission")}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/settings")}>
          {t("backToSettings")}
        </Button>
      </div>
    );
  }

  return <RolesManager />;
}
