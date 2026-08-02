"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProject } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { useTranslations } from "next-intl";

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectForm({ open, onOpenChange }: ProjectFormProps) {
  const router = useRouter();
  const t = useTranslations("projects.form");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState("");
  const createProject = useCreateProject();
  const { data: areas } = useAreas();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setError("");
    try {
      const created = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        areaId: areaId || undefined,
      }) as { id: string };
      setName("");
      setDescription("");
      setAreaId("");
      onOpenChange(false);
      router.push(`/board/${created.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("createFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t("nameLabel")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t("descriptionLabel")}</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t("teamArea")}</label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue placeholder={t("areaPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {areas?.map((a: { id: string; name: string }) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-body-small text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
