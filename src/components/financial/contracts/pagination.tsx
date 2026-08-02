"use client";

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
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 py-3 text-sm text-text-secondary">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Next page"
      >
        Next <ChevronRight size={16} />
      </button>
    </nav>
  );
}
