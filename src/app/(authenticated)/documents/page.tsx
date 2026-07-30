"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentList } from "@/components/documents/document-list";
import { useCreateDocument, useDeleteDocument } from "@/hooks/use-documents";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function DocumentsPage() {
  const router = useRouter();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSelectDoc(id: string) {
    router.push(`/documents/${id}`);
  }

  async function handleNewDoc() {
    const doc = await createDoc.mutateAsync({ title: "Untitled Document" }) as { id: string };
    router.push(`/documents/${doc.id}`);
  }

  function handleDeleteDoc(id: string) {
    setDeleteId(id);
  }

  function confirmDelete() {
    if (deleteId) {
      deleteDoc.mutate(deleteId);
      setDeleteId(null);
    }
  }

  return (
    <div data-testid="documents-page" className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-text-primary" />
        <h1 className="text-heading-1 font-semibold text-text-primary">Documents</h1>
      </div>
      <DocumentList onSelectDoc={handleSelectDoc} onNewDoc={handleNewDoc} onDeleteDoc={handleDeleteDoc} />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
