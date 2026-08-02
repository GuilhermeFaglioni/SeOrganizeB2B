import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: string;
  projectId?: string;
  installmentStatus?: string;
  [key: string]: string | undefined;
}

export interface OverviewData {
  kpis: {
    activeContractedValue: string;
    mrr: string;
    arr: string;
    cashForecast: string;
    received: string;
    overdue: string;
    upsell: string;
    downsell: string;
    activeContracts: number;
    expiringSoon: number;
  };
  monthly: Array<{ month: string; forecast: string; received: string }>;
  overdueInstallments: Array<{
    id: string;
    contractCode: string;
    contractTitle: string;
    clientName: string;
    expectedAmount: string;
    dueDate: string;
  }>;
  expiringContracts: Array<{
    id: string;
    code: string;
    title: string;
    clientName: string;
    status: string;
    endDate: string;
    officialValue: string;
  }>;
}

export function useOverview(filters: OverviewFilters) {
  return useQuery<OverviewData>({
    queryKey: ["overview", filters],
    queryFn: () =>
      fetchJson<OverviewData>(`/api/financial/overview${qs(filters)}`),
    enabled: Boolean(filters.period),
  });
}
