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

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectForm({ open, onOpenChange }: ProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState("");
  const createProject = useCreateProject();
  const { data: areas } = useAreas();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Project name is required");
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
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a new project to organize your work.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-label text-text-secondary">Project Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Product Launch"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-text-secondary">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-text-secondary">Team Area</label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Select area (optional)" />
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
