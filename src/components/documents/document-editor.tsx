"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MarkdownPreview } from "./markdown-preview";
import { useAutoSave } from "@/hooks/use-documents";
import { useProjects } from "@/hooks/use-projects";
import { Save, Eye, Edit, Columns } from "lucide-react";

type ViewMode = "split" | "edit" | "preview";

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  projectId: initialProjectId,
}: {
  documentId: string;
  initialTitle?: string;
  initialContent?: string;
  projectId?: string | null;
}) {
  const [title, setTitle] = useState(initialTitle || "");
  const [content, setContent] = useState(initialContent || "");
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const { scheduleSave, updateDoc } = useAutoSave();
  const { data: projects } = useProjects();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    if (!initialTitle && !initialContent && !initialProjectId) return;
    setTitle(initialTitle || "");
    setContent(initialContent || "");
    setProjectId(initialProjectId || "");
    synced.current = true;
  }, [initialTitle, initialContent, initialProjectId, documentId]);

  const handleContentChange = useCallback(
    (val?: string) => {
      const newContent = val || "";
      setContent(newContent);
      scheduleSave(documentId, { content: newContent });
    },
    [documentId, scheduleSave]
  );

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      scheduleSave(documentId, { title: val });
    },
    [documentId, scheduleSave]
  );

  function handleSave() {
    updateDoc.mutate({ id: documentId, title, content, projectId: projectId || undefined });
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="document-editor">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-page-alt px-4 py-2">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="min-w-0 flex-1 basis-full bg-transparent text-[18px] font-semibold text-text-primary outline-none sm:basis-auto"
          placeholder="Untitled Document"
        />
        <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-input bg-page-alt px-2 py-1 text-sm sm:flex-none"
          >
            <option value="">No project</option>
            {projects?.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("edit")}
              className={`p-1.5 ${viewMode === "edit" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`}
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 ${viewMode === "split" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`}
              title="Split"
            >
              <Columns size={16} />
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`p-1.5 ${viewMode === "preview" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`}
              title="Preview"
            >
              <Eye size={16} />
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={updateDoc.isPending}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90 disabled:opacity-50 sm:min-h-0 sm:min-w-0"
            aria-label="Save document"
            title="Save document"
          >
            <Save className="h-4 w-4 sm:hidden" aria-hidden="true" />
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {(viewMode === "edit" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "md:w-1/2 w-full h-1/2 md:h-full" : "w-full"} flex min-h-0 flex-col border-r border-border`}>
            <div className="min-h-0 flex-1 overflow-auto">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="h-full min-h-0 w-full resize-none border-none bg-page-alt p-4 font-mono text-sm outline-none"
                placeholder="Start writing markdown..."
              />
            </div>
          </div>
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "md:w-1/2 w-full h-1/2 md:h-full" : "w-full"} min-h-0 overflow-auto`}>
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
