"use client";

import { FileText, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface DocumentRowDoc {
  id: string;
  title: string;
  updatedAt: string;
  project?: { id: string; name: string } | null;
}

export function DocumentRow({
  doc,
  onClick,
  onDelete,
}: {
  doc: DocumentRowDoc;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  const t = useTranslations("documents.row");
  const updated = new Date(doc.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      data-testid="document-row"
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-[14px] bg-page-alt border-b border-border hover:bg-bg-secondary cursor-pointer transition-colors"
    >
      <FileText size={18} className="text-text-secondary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-text-primary truncate">{doc.title}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[12px] text-text-secondary">.md</span>
          <span className="text-[12px] text-text-secondary">{updated}</span>
          {doc.project && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-tertiary text-text-secondary">
              {doc.project.name}
            </span>
          )}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-text-secondary hover:text-danger transition-colors p-1"
          aria-label={t("deleteDocument")}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
