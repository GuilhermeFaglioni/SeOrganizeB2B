"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("financial.contracts.pagination");
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t("paginationLabel")} className="flex items-center justify-between gap-2 py-3 text-sm text-text-secondary">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label={t("previousAria")}
      >
        <ChevronLeft size={16} /> {t("previous")}
      </button>
      <span aria-live="polite">
        {t("pageInfo", { page, total: totalPages })}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label={t("nextAria")}
      >
        {t("next")} <ChevronRight size={16} />
      </button>
    </nav>
  );
}
