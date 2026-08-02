"use client";

import { useState } from "react";
import { useDocuments, type DocumentData } from "@/hooks/use-documents";
import { useProjects } from "@/hooks/use-projects";
import { DocumentRow } from "./document-row";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const { data: documents, isLoading } = useDocuments(activeProjectId);

  function handleSetFilter(id: string | null) {
    setActiveProjectId(id);
  }

  return (
    <div data-testid="document-list">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => handleSetFilter(null)}
            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${
              !activeProjectId ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            {t("allDocuments")}
          </button>
          {projects?.map((p: { id: string; name: string }) => (
            <button
              key={p.id}
              onClick={() => handleSetFilter(p.id)}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${
                activeProjectId === p.id ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={onNewDoc}
            className="ml-2 flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent/90"
          >
            <Plus size={16} />
            {t("new")}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-body-small text-text-secondary text-center py-8">{t("loading")}</div>
      )}

      {!isLoading && documents && documents.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          {documents.map((doc: DocumentData) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onClick={() => onSelectDoc?.(doc.id)}
              onDelete={(e) => {
                e.stopPropagation();
                onDeleteDoc?.(doc.id);
              }}
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
