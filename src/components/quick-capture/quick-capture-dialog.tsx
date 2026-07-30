"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckSquare2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateDocument } from "@/hooks/use-documents";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { toastError, toastSuccess } from "@/lib/toast";

type CaptureType = "task" | "event" | "document";

export function QuickCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const { data: projects = [] } = useProjects();
  const createTask = useCreateTask(projectId);
  const createDocument = useCreateDocument();
  const { openScheduleEvent } = useScheduleEventDialog();

  useEffect(() => {
    if (open && !projectId && projects[0]) setProjectId(projects[0].id);
  }, [open, projectId, projects]);

  function choose(nextType: CaptureType) {
    if (nextType === "event") {
      onOpenChange(false);
      openScheduleEvent();
      return;
    }
    setType(nextType);
  }

  async function submit() {
    try {
      if (type === "document") {
        const document = (await createDocument.mutateAsync({
          title: title.trim() || "Untitled Document",
        })) as { id: string };
        onOpenChange(false);
        setTitle("");
        router.push(`/documents/${document.id}`);
        toastSuccess("Documento criado");
        return;
      }
      if (!title.trim() || !projectId) return;
      const response = await fetch(
        `/api/projects/${projectId}/columns?includeTasks=false`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message);
      const column = (
        payload.data as Array<{ id: string; completesTasks: boolean }>
      ).find((item) => !item.completesTasks);
      if (!column) throw new Error("Projeto sem coluna de trabalho");
      await createTask.mutateAsync({
        title: title.trim(),
        columnId: column.id,
      });
      onOpenChange(false);
      setTitle("");
      toastSuccess("Tarefa capturada");
      router.push(`/board?project=${projectId}`);
    } catch (error) {
      toastError(
        "Falha na captura",
        error instanceof Error ? error.message : undefined
      );
    }
  }

  const choices = [
    { key: "task" as const, label: "Tarefa", icon: CheckSquare2 },
    { key: "event" as const, label: "Evento", icon: CalendarDays },
    { key: "document" as const, label: "Documento", icon: FileText },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Capture</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {choices.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium ${
                type === key
                  ? "border-accent bg-brand-50 text-accent"
                  : "border-border text-text-secondary hover:bg-page"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {type !== "event" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="capture-title">
                {type === "task" ? "Título da tarefa" : "Título do documento"}
              </Label>
              <Input
                id="capture-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
              />
            </div>
            {type === "task" && (
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={submit}
                disabled={
                  createTask.isPending ||
                  createDocument.isPending ||
                  (type === "task" && (!title.trim() || !projectId))
                }
              >
                Capturar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
