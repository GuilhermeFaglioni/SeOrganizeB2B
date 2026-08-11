"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

interface AdminPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
  isDefault: boolean;
  isActive: boolean;
}

export default function AdminPlansPage() {
  const t = useTranslations("admin.pages.plans");
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json) => {
        setPlans(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div data-testid="admin-plans-page" className="p-6">
      <h1 className="text-heading-1 font-semibold text-text-primary">
        {t("title")}
      </h1>
      {loading && <p className="mt-4 text-body-small text-text-secondary">{t("loading")}</p>}
      {error && <p className="mt-4 text-body-small text-danger">{t("error")}</p>}
      {!loading && !error && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="py-2 pr-4 font-medium">{t("name")}</th>
              <th className="py-2 pr-4 font-medium">{t("modules")}</th>
              <th className="py-2 pr-4 font-medium">{t("default")}</th>
              <th className="py-2 pr-4 font-medium">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-border">
                <td className="py-2 pr-4 text-text-primary">
                  <Link
                    href={`/admin/plans/${plan.id}`}
                    className="font-medium text-text-primary hover:text-accent hover:underline"
                  >
                    {plan.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {plan.allowedModules.length > 0
                    ? plan.allowedModules.join(", ")
                    : "—"}
                </td>
                <td className="py-2 pr-4">
                  {plan.isDefault ? (
                    <Badge variant="success">{t("yes")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("no")}</Badge>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {plan.isActive ? (
                    <Badge variant="success">{t("active")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("inactive")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}