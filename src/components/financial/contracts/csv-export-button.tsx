"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

export function CsvExportButton({
  onExport,
  label,
}: {
  onExport: () => void;
  label?: string;
}) {
  const t = useTranslations("financial.contracts.csvExport");
  return (
    <button
      type="button"
      onClick={onExport}
      className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-page-alt px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <Download size={16} aria-hidden="true" />
      {label ?? t("exportLabel")}
    </button>
  );
}
