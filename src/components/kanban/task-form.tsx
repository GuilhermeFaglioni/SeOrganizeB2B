"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAreas } from "@/hooks/use-areas";
import { DEFAULT_PRIORITIES } from "@/lib/constants";
import { MultiPersonSelector } from "@/components/people/multi-person-selector";

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columnId: string;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    assignees?: Array<{
      profileId: string;
      profile: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
      };
    }>;
    areaId?: string | null;
    priority?: string;
    dueDate?: string | null;
    recurrenceType?: "daily" | "weekly" | "monthly" | null;
    recurrenceInterval?: number | null;
  } | null;
  profiles?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  }[];
}

export function TaskForm({ open, onOpenChange, projectId, columnId, task, profiles }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [areaId, setAreaId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [error, setError] = useState("");

  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const { data: areas } = useAreas();
  const { data: fetchedProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const res = await fetch("/api/profiles");
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data as {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
      }[];
    },
  });
  const allProfiles = profiles || fetchedProfiles;

  const isEditing = !!task;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setAssigneeIds(task.assignees?.map((assignment) => assignment.profileId) || []);
      setAreaId(task.areaId || "");
      setPriority(task.priority || "medium");
      setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
      setRecurrenceType(task.recurrenceType || "none");
      setRecurrenceInterval(task.recurrenceInterval || 1);
    } else {
      setTitle("");
      setDescription("");
      setAssigneeIds([]);
      setAreaId("");
      setPriority("medium");
      setDueDate("");
      setRecurrenceType("none");
      setRecurrenceInterval(1);
    }
    setError("");
  }, [task, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      if (isEditing && task) {
        await updateTask.mutateAsync({
          id: task.id,
          title: title.trim(),
          description: description || undefined,
          assigneeIds,
          areaId: areaId || undefined,
          priority,
          dueDate: dueDate || undefined,
          recurrenceType:
            recurrenceType === "none"
              ? null
              : (recurrenceType as "daily" | "weekly" | "monthly"),
          recurrenceInterval:
            recurrenceType === "none" ? null : recurrenceInterval,
        });
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description || undefined,
          columnId,
          assigneeIds,
          areaId: areaId || undefined,
          priority,
          dueDate: dueDate || undefined,
          recurrenceType:
            recurrenceType === "none"
              ? null
              : (recurrenceType as "daily" | "weekly" | "monthly"),
          recurrenceInterval:
            recurrenceType === "none" ? null : recurrenceInterval,
        });
      }
      toastSuccess(
        isEditing ? "Tarefa atualizada" : "Tarefa criada",
        assigneeIds.length > 1
          ? `${assigneeIds.length} pessoas atribuídas.`
          : undefined,
      );
      onOpenChange(false);
    } catch {
      setError("Failed to save task");
      toastError("Failed to save task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description"
                  className="flex min-h-[250px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Assignees</Label>
                <MultiPersonSelector
                  people={allProfiles || []}
                  value={assigneeIds}
                  onValueChange={setAssigneeIds}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Team Area</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger id="area">
                    <SelectValue placeholder="Select area" />
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
              <div className="space-y-2">
                <Label>Priority</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        priority === p
                          ? "border-accent bg-accent text-white"
                          : "border-border bg-white text-text-secondary hover:border-accent"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-2">
                  <Label>Recurrence</Label>
                  <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurrenceInterval">Every</Label>
                  <Input
                    id="recurrenceInterval"
                    type="number"
                    min={1}
                    max={365}
                    value={recurrenceInterval}
                    disabled={recurrenceType === "none"}
                    onChange={(event) =>
                      setRecurrenceInterval(
                        Math.min(365, Math.max(1, Number(event.target.value) || 1))
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
