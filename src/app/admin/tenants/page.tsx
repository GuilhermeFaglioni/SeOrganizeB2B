"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { useAdminTenants, useDeleteTenant, useUpdateTenant } from "@/hooks/use-admin-tenants";
import type { AdminTenant } from "@/hooks/use-admin-tenants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";

function statusVariant(status: AdminTenant["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "grace_period":
      return "warning" as const;
    case "cancelled":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default function AdminTenantsPage() {
  const t = useTranslations("admin.pages.tenants");
  const { data: tenants, isLoading, isError } = useAdminTenants();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  if (isLoading) {
    return (
      <div className="p-6" data-testid="admin-tenants-page">
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6" data-testid="admin-tenants-page">
        <EmptyState
          icon={Building2}
          title={t("title")}
          description={t("loadFailed")}
        />
      </div>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="p-6" data-testid="admin-tenants-page">
        <h1 className="mb-1 text-2xl font-semibold">{t("title")}</h1>
        <EmptyState icon={Building2} title={t("empty")} />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="admin-tenants-page">
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-page-alt text-left text-xs uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-3 font-medium">{t("name")}</th>
              <th className="px-4 py-3 font-medium">{t("slug")}</th>
              <th className="px-4 py-3 font-medium">{t("statusLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("plan")}</th>
              <th className="px-4 py-3 font-medium">{t("usage")}</th>
              <th className="px-4 py-3 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-4 py-3 font-medium">{tenant.name}</td>
                <td className="px-4 py-3 text-text-secondary">{tenant.slug}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(tenant.status)}>
                    {t(`status.${tenant.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {tenant.plan?.name ?? t("noPlan")}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {tenant.usage.users} {t("usageUsers")} · {tenant.usage.tasks}{" "}
                  {t("usageTasks")} · {tenant.usage.projects} {t("usageProjects")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tenant.status !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateTenant.mutate({ id: tenant.id, status: "active" })
                        }
                      >
                        {t("activate")}
                      </Button>
                    )}
                    {tenant.status !== "grace_period" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateTenant.mutate({
                            id: tenant.id,
                            status: "grace_period",
                          })
                        }
                      >
                        {t("gracePeriod")}
                      </Button>
                    )}
                    {tenant.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateTenant.mutate({ id: tenant.id, status: "cancelled" })
                        }
                      >
                        {t("cancel")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateTenant.mutate({
                          id: tenant.id,
                          extendGracePeriod: true,
                        })
                      }
                    >
                      {t("extendGrace")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTenant.mutate(tenant.id)}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}