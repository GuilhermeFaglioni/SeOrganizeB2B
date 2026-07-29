"use client";

import { useRouter } from "next/navigation";
import { DocumentList } from "@/components/documents/document-list";
import { useCreateDocument } from "@/hooks/use-documents";
import { FileText } from "lucide-react";

export default function DocumentsPage() {
  const router = useRouter();
  const createDoc = useCreateDocument();

  function handleSelectDoc(id: string) {
    router.push(`/documents/${id}`);
  }

  async function handleNewDoc() {
    const doc = await createDoc.mutateAsync({ title: "Untitled Document" }) as { id: string };
    router.push(`/documents/${doc.id}`);
  }

  return (
    <div data-testid="documents-page" className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-text-primary" />
        <h1 className="text-heading-1 font-semibold text-text-primary">Documents</h1>
      </div>
      <DocumentList onSelectDoc={handleSelectDoc} onNewDoc={handleNewDoc} />
    </div>
  );
}
