"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useDocument } from "@/hooks/use-documents";
import { DocumentEditor } from "@/components/documents/document-editor";
import { LoadingState } from "@/components/shared/loading-state";

export default function DocumentEditorPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const { data: doc, isLoading } = useDocument(params.documentId);

  if (isLoading) return <LoadingState />;

  return (
    <div data-testid="document-editor-page" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-page-alt">
        <button
          onClick={() => router.push("/documents")}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DocumentEditor
          documentId={params.documentId}
          initialTitle={doc?.title}
          initialContent={doc?.content}
          projectId={doc?.projectId}
        />
      </div>
    </div>
  );
}
