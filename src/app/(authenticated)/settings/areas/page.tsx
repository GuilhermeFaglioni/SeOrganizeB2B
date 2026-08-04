"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { useCan } from "@/hooks/use-permissions";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

export default function SettingsAreasPage() {
  const t = useTranslations("settings.areas");
  const { can } = useCan();
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
      setError(e instanceof Error ? e.message : t("createError"));
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
      setEditError(e instanceof Error ? e.message : t("updateError"));
    }
  };

  const handleDelete = () => {
    if (!deleteArea) return;
    deleteAreaMut.mutate(deleteArea.id);
    setDeleteOpen(false);
    setDeleteArea(null);
  };

  return (
    <SettingsShell testId="areas-settings-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader
        title={t("title")}
        description={t("subtitle")}
        action={can("areas.create") ? (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addArea")}
          </Button>
        ) : undefined}
      />

      <SettingsSection>
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
      </SettingsSection>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="edit-area-modal">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-label text-text-secondary">{t("areaNameLabel")}</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            {editError && <p className="text-body-small text-danger">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleEdit} disabled={!editName.trim() || !can("areas.edit")}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="add-area-modal">
          <DialogHeader>
            <DialogTitle>{t("addArea")}</DialogTitle>
            <DialogDescription>
              {t("addDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-label text-text-secondary">{t("areaNameLabel")}</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("namePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {error && (
              <p className="text-body-small text-danger">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="delete-area-modal">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle", { name: deleteArea?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {t("deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {impact && (
              <div className="flex gap-4 text-body-small text-text-secondary">
                <span>{t("tasksAffected", { count: impact.tasks })}</span>
                <span>{t("projectsAffected", { count: impact.projects })}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!can("areas.delete")}>
              {t("deleteArea")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsShell>
  );
}
