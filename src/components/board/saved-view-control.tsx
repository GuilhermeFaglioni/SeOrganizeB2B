"use client";

import { useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  type BoardViewFilters,
} from "@/hooks/use-saved-views";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toastError, toastSuccess } from "@/lib/toast";

const NONE = "__none__";

export function SavedViewControl({
  filters,
  onApply,
}: {
  filters: BoardViewFilters;
  onApply: (filters: BoardViewFilters) => void;
}) {
  const [selectedId, setSelectedId] = useState(NONE);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const { data: views = [] } = useSavedViews();
  const create = useCreateSavedView();
  const remove = useDeleteSavedView();

  async function save() {
    if (!viewName.trim()) return;
    try {
      const view = await create.mutateAsync({
        name: viewName.trim(),
        scope: "board",
        filters,
      });
      setSelectedId((view as { id: string }).id);
      setViewName("");
      setSaveViewOpen(false);
      toastSuccess("Visualização salva");
    } catch (error) {
      toastError(
        "Falha ao salvar visualização",
        error instanceof Error ? error.message : undefined
      );
    }
  }

  function select(id: string) {
    setSelectedId(id);
    const view = views.find((item) => item.id === id);
    if (view) onApply(view.filters);
  }

  async function deleteSelected() {
    if (selectedId === NONE) return;
    await remove.mutateAsync(selectedId);
    setSelectedId(NONE);
    toastSuccess("Visualização removida");
  }

  return (
    <>
      <div className="ml-auto flex items-center gap-1">
      <Select value={selectedId} onValueChange={select}>
        <SelectTrigger className="w-[180px] bg-white">
          <SelectValue placeholder="Minhas views" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Minhas views</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="outline"
        onClick={() => setSaveViewOpen(true)}
        title="Salvar view"
      >
        <BookmarkPlus className="h-4 w-4" />
      </Button>
      {selectedId !== NONE && (
        <Button
          size="icon"
          variant="outline"
          onClick={deleteSelected}
          title="Excluir view"
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      )}
      </div>
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar visualização</DialogTitle>
          <DialogDescription>
            Salva filtros, ordenação e agrupamento atuais apenas para você.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="saved-view-name">Nome</Label>
          <Input
            id="saved-view-name"
            autoFocus
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
            placeholder="Ex.: Entregas desta semana"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={!viewName.trim() || create.isPending}
          >
            {create.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
