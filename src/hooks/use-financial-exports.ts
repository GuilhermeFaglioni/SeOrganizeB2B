import { toastError } from "@/lib/toast";
import { qs } from "@/lib/financial/http";

export interface ContractExportFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
  [key: string]: string | undefined;
}

export interface ReceivablesExportFilters {
  status?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  [key: string]: string | undefined;
}

async function downloadCsv(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Export failed");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export async function exportContractsCsv(
  filters: ContractExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/contracts${qs(filters)}`,
      "contracts.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}

export async function exportReceivablesCsv(
  filters: ReceivablesExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/receivables${qs(filters)}`,
      "receivables.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}
