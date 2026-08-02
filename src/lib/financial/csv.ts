import type { Money } from "./money";
import { formatBRL } from "./money";

export function csvEscape(value: string | number | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  const neutralized = text.replace(/^([=+\-@\t\r])/, "'$1");
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function moneyCell(value: Money): string {
  return csvEscape(formatBRL(value));
}

export function csvDocument(rows: string[][]): string {
  const body = rows.map((row) => row.join(",")).join("\n");
  return `\ufeff${body}\n`;
}

export const CONTRACTS_CSV_HEADERS = [
  "Code",
  "Title",
  "Client",
  "Status",
  "Duration Type",
  "Official Value (BRL)",
  "Start Date",
  "End Date",
  "Billing Frequency",
  "Payment Method",
  "Owner",
] as const;

export const RECEIVABLES_CSV_HEADERS = [
  "Contract Code",
  "Contract Title",
  "Client",
  "Expected Amount (BRL)",
  "Status",
  "Due Date",
  "Payment Method",
  "Paid Date",
] as const;
