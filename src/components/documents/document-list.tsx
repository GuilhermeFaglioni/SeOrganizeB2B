"use client";

import { useState } from "react";
import { useDocuments, type DocumentData } from "@/hooks/use-documents";
import { useCan } from "@/hooks/use-permissions";
import { useProjects } from "@/hooks/use-projects";
import { DocumentRow } from "./document-row";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function DocumentList({
  onSelectDoc,
  onNewDoc,
  onDeleteDoc,
}: {
  onSelectDoc?: (id: string) => void;
  onNewDoc?: () => void;
  onDeleteDoc?: (id: string) => void;
}) {
  const { data: projects } = useProjects();
  const t = useTranslations("documents.list");
  const { can } = useCan();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const { data: documents, isLoading } = useDocuments(activeProjectId);

  function handleSetFilter(id: string | null) {
    setActiveProjectId(id);
  }

  return (
    <div data-testid="document-list">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 overflow-x-auto">
          <Button
            type="button"
            variant={activeProjectId ? "soft" : "solid"}
            color={activeProjectId ? "neutral" : "primary"}
            size="sm"
            onClick={() => handleSetFilter(null)}
            className="rounded-balsa-control whitespace-nowrap"
          >
            {t("allDocuments")}
          </Button>
          {projects?.map((p: { id: string; name: string }) => (
            <Button
              key={p.id}
              type="button"
              variant={activeProjectId === p.id ? "solid" : "soft"}
              color={activeProjectId === p.id ? "primary" : "neutral"}
              size="sm"
              onClick={() => handleSetFilter(p.id)}
              className="rounded-balsa-control whitespace-nowrap"
            >
              {p.name}
            </Button>
          ))}
          {can("documents.create") && (
          <Button
            type="button"
            size="sm"
            prefixIcon={Plus}
            onClick={onNewDoc}
            className="ml-2 rounded-balsa-control"
          >
            {t("new")}
          </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-body-small text-text-secondary text-center py-8">{t("loading")}</div>
      )}

      {!isLoading && documents && documents.length > 0 && (
        <div className="balsa-surface overflow-hidden rounded-balsa-surface">
          {documents.map((doc: DocumentData) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onClick={() => onSelectDoc?.(doc.id)}
              onDelete={
                can("documents.delete")
                  ? (e) => {
                      e.stopPropagation();
                      onDeleteDoc?.(doc.id);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {!isLoading && documents && documents.length === 0 && (
        <div className="text-body-small text-text-secondary text-center py-8">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
