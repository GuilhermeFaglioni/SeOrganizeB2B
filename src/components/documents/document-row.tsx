"use client";

import { FileText, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

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
      className="flex cursor-pointer items-center gap-4 border-b border-balsa-border bg-balsa-surface/70 px-5 py-[14px] transition-colors hover:bg-balsa-muted"
    >
      <FileText size={18} className="h-[18px] w-[18px] shrink-0 text-balsa-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-balsa-foreground">{doc.title}</div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-xs text-balsa-muted-foreground">.md</span>
          <span className="text-xs text-balsa-muted-foreground">{updated}</span>
          {doc.project && (
            <span className="inline-flex items-center rounded-balsa-control bg-balsa-surface-elevated px-1.5 py-0.5 text-balsa-2xs font-medium text-balsa-muted-foreground">
              {doc.project.name}
            </span>
          )}
        </div>
      </div>
      {onDelete && (
        <Button
          type="button"
          variant="text"
          color="destructive"
          size="icon"
          onClick={onDelete}
          className="shrink-0"
          aria-label={t("deleteDocument")}
        >
          <Trash2 size={16} />
        </Button>
      )}
    </div>
  );
}
