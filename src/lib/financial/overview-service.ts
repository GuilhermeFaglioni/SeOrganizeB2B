import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import {
  activeContractedValue,
  arrForContract,
  forecastTotal,
  groupMonthly,
  isExpiringSoon,
  mrrForContract,
  overdueTotal,
  receivedTotal,
  sumChangeDeltas,
} from "./metrics";
import { extendRecurringHorizons } from "./installments-service";
import { addDaysCivil, addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { moneyToJson, sum, toDecimal } from "./money";
import type { BillingFrequency, ContractStatus, InstallmentStatus } from "./types";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: ContractStatus;
  projectId?: string;
  installmentStatus?: InstallmentStatus;
  contractWhere?: Prisma.ContractWhereInput;
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

export async function computeOverview(
  filters: OverviewFilters
): Promise<OverviewData> {
  const today = todayCivilDate();
  const from =
    filters.period === "custom"
      ? filters.from ?? today
      : filters.period === "currentMonth"
        ? `${today.slice(0, 7)}-01`
        : today;
  const to =
    filters.period === "custom"
      ? filters.to ?? addDaysCivil(today, 90)
      : filters.period === "currentMonth"
        ? addDaysCivil(addMonthsCivil(from, 1), -1)
        : addDaysCivil(today, 90);

  return prisma.$transaction(async (tx) => {
    await extendRecurringHorizons(tx);

    const contractWhere: Prisma.ContractWhereInput = {
      ...(filters.contractWhere ?? {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.contractStatus ? { status: filters.contractStatus } : {}),
      ...(filters.projectId ? { projects: { some: { projectId: filters.projectId } } } : {}),
    };

    const contracts = await tx.contract.findMany({
      where: contractWhere,
      include: { client: true },
    });
    const installments = await tx.installment.findMany({
      where: {
        contract: contractWhere,
        ...(filters.installmentStatus ? { status: filters.installmentStatus } : {}),
      },
    });
    const changes = await tx.contractChange.findMany({
      where: { contract: contractWhere },
    });

    const active = contracts.filter((c) => c.status === "active");
    const mrr = sum(
      active.map((c) =>
        mrrForContract({
          officialValue: c.officialValue ?? toDecimal(0),
          durationType: c.durationType ?? "",
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate ?? "",
          endDate: c.endDate ?? null,
        }) ?? toDecimal(0)
      )
    );
    const arr = sum(
      active.map((c) =>
        arrForContract({
          officialValue: c.officialValue ?? toDecimal(0),
          durationType: c.durationType ?? "",
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate ?? "",
          endDate: c.endDate ?? null,
        }) ?? toDecimal(0)
      )
    );

    const overdueInstallments = installments
      .filter((i) => i.status === "pending" && compareCivil(i.dueDate, today) < 0)
      .sort((a, b) => compareCivil(a.dueDate, b.dueDate))
      .slice(0, 10)
      .map((i) => {
        const contract = contracts.find((c) => c.id === i.contractId);
        return {
          id: i.id,
          contractCode: contract?.code ?? "",
          contractTitle: contract?.title ?? "",
          clientName: contract?.client?.name ?? "",
          expectedAmount: moneyToJson(i.expectedAmount),
          dueDate: i.dueDate,
        };
      });

    const expiringContracts = active
      .filter(
        (c) => c.durationType === "fixed" && c.endDate && isExpiringSoon(c.endDate, today)
      )
      .sort((a, b) => compareCivil(a.endDate as string, b.endDate as string))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title ?? "",
        clientName: c.client?.name ?? "",
        status: c.status,
        endDate: c.endDate as string,
        officialValue: moneyToJson(c.officialValue ?? toDecimal(0)),
      }));

    return {
      kpis: {
        activeContractedValue: moneyToJson(
          activeContractedValue(
            contracts.map((c) => ({
              status: c.status,
              durationType: c.durationType ?? "",
              officialValue: c.officialValue ?? toDecimal(0),
            }))
          )
        ),
        mrr: moneyToJson(mrr),
        arr: moneyToJson(arr),
        cashForecast: moneyToJson(forecastTotal(installments, from, to)),
        received: moneyToJson(receivedTotal(installments, from, to)),
        overdue: moneyToJson(overdueTotal(installments, today)),
        upsell: moneyToJson(sumChangeDeltas(changes, "upsell", from, to)),
        downsell: moneyToJson(sumChangeDeltas(changes, "downsell", from, to)),
        activeContracts: active.length,
        expiringSoon: expiringContracts.length,
      },
      monthly: groupMonthly(installments, from, to).map((p) => ({
        month: p.month,
        forecast: moneyToJson(p.forecast),
        received: moneyToJson(p.received),
      })),
      overdueInstallments,
      expiringContracts,
    };
  });
}
