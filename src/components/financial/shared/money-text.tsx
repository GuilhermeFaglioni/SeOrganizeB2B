import { toDecimal, formatBRL } from "@/lib/financial/money";

export function MoneyText({ value, className }: { value: string; className?: string }) {
  return <span className={className}>{formatBRL(toDecimal(value))}</span>;
}
