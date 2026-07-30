"use client";

import { useState } from "react";
import { AreaList } from "@/components/areas/area-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateArea,
  useDeleteArea,
  useUpdateArea,
  useAreaImpact,
} from "@/hooks/use-areas";
import { Plus } from "lucide-react";

export default function SettingsAreasPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteArea, setDeleteArea] = useState<{ id: string; name: string } | null>(null);
  const [editArea, setEditArea] = useState<{ id: string; name: string; color: string | null } | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");

  const updateArea = useUpdateArea();
  const createArea = useCreateArea();
  const deleteAreaMut = useDeleteArea();
  const { data: impact } = useAreaImpact(deleteArea?.id ?? "");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError("");
    try {
      await createArea.mutateAsync({ name: newName.trim() });
      setNewName("");
      setAddOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create area");
    }
  };

  const handleEdit = async () => {
    if (!editArea || !editName.trim()) return;
    setEditError("");
    try {
      await updateArea.mutateAsync({ id: editArea.id, name: editName.trim(), color: editArea.color ?? undefined });
      setEditOpen(false);
      setEditArea(null);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update area");
    }
  };

  const handleDelete = () => {
    if (!deleteArea) return;
    deleteAreaMut.mutate(deleteArea.id);
    setDeleteOpen(false);
    setDeleteArea(null);
  };

  return (
    <div data-testid="areas-settings-page" className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-text-primary">Team Areas</h1>
          <p className="text-body-small text-text-secondary mt-1">
            Manage areas used to organize projects and tasks.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Area
        </Button>
      </div>

      <AreaList
        onEdit={(area) => {
          setEditArea(area);
          setEditName(area.name);
          setEditOpen(true);
        }}
        onDelete={(area) => {
          setDeleteArea(area);
          setDeleteOpen(true);
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="edit-area-modal">
          <DialogHeader>
            <DialogTitle>Edit Area</DialogTitle>
            <DialogDescription>Rename this team area.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Area Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            {editError && <p className="text-body-small text-danger">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="add-area-modal">
          <DialogHeader>
            <DialogTitle>Add Area</DialogTitle>
            <DialogDescription>
              Create a new team area to organize projects and tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Area Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Design, Engineering"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {error && (
              <p className="text-body-small text-danger">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="delete-area-modal">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteArea?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Tasks and projects assigned to this
              area will show as unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {impact && (
              <div className="flex gap-4 text-body-small text-text-secondary">
                <span>{impact.tasks} tasks affected</span>
                <span>{impact.projects} projects affected</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
