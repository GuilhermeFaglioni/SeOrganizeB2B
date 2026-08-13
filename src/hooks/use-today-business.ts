"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { TodayBusinessData } from "@/lib/financial/today-business-service";

export function useTodayBusiness() {
  const t = useTranslations("hooks.today");
  return useQuery<TodayBusinessData>({
    queryKey: ["today-business"],
    queryFn: async () => {
      const response = await fetch("/api/today/business");
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || t("loadFailed"));
      }
      return body.data;
    },
  });
}
