"use client";

import { useState, useEffect, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
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

  useEffect(() => {
    setTitle(initialTitle || "");
    setContent(initialContent || "");
    setProjectId(initialProjectId || "");
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
    <div className="flex flex-col h-full" data-testid="document-editor">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-white">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-[18px] font-semibold bg-transparent border-none outline-none flex-1 text-text-primary"
          placeholder="Untitled Document"
        />
        <div className="flex items-center gap-2">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-sm border border-input rounded-md px-2 py-1 bg-white"
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
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {(viewMode === "edit" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2" : "w-full"} overflow-auto border-r border-border`}>
            <MDEditor
              value={content}
              onChange={handleContentChange}
              height="100%"
              preview="edit"
              hideToolbar
            />
          </div>
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2" : "w-full"} overflow-auto`}>
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
