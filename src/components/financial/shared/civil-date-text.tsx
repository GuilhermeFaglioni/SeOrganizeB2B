import { formatCivilDate } from "@/lib/financial/civil-date";

export function CivilDateText({
  date,
  className,
}: {
  date: string | null;
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  return <span className={className}>{formatCivilDate(date)}</span>;
}
