"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { AreaBadge } from "@/components/areas/area-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/shared/loading-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Edit3,
  Trash2,
  ArrowLeft,
  ListChecks,
  Columns,
  Clock,
  AlertCircle,
  CheckCircle2,

} from "lucide-react";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  areaId: string | null;
  area: { id: string; name: string; color: string } | null;
  _count: { tasks: number; documents: number };
  columns: { id: string; name: string; position: number; _count: { tasks: number } }[];
  creator: { id: string; name: string | null; email: string };
  stats: {
    totalTasks: number;
    overdueTasks: number;
    archivedTasks: number;
    thisWeekTasks: number;
    activeTasks: number;
    completionRate: number;
  };
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.projectId;
  const { data: areas } = useAreas();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => fetchJson<ProjectDetail>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAreaId, setEditAreaId] = useState("");

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditAreaId(project.areaId || "");
    }
  }, [project]);

  const handleEdit = async () => {
    if (!editName.trim()) return;
    await updateProject.mutateAsync({ id: projectId, name: editName.trim(), description: editDescription.trim() || undefined, areaId: editAreaId || undefined });
    setEditOpen(false);
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(projectId);
    setDeleteOpen(false);
    router.push("/projects");
  };

  if (isLoading) return <LoadingState />;
  if (!project) return <div className="p-6 text-center text-text-secondary">Project not found</div>;

  return (
    <div className="h-full overflow-hidden p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-3 overflow-y-auto lg:gap-4 lg:overflow-hidden">
        <header className="flex shrink-0 flex-col gap-3 rounded-xl border border-border bg-page-alt px-4 py-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              onClick={() => router.push("/projects")}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
              aria-label="Back to projects"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-text-primary">
                  {project.name}
                </h1>
                {project.area && (
                  <AreaBadge
                    name={project.area.name}
                    color={project.area.color}
                  />
                )}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span>
                  Created by {project.creator.name || project.creator.email}
                </span>
                {project.description && (
                  <span className="max-w-2xl truncate text-text-muted">
                    {project.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push(`/board/${projectId}`)}
            >
              <LayoutDashboard className="h-4 w-4" />
              Open Board
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Archive
            </Button>
          </div>
        </header>

        <section
          className="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5 lg:gap-3"
          aria-label="Project indicators"
        >
          <MetricCard icon={ListChecks} label="Total Tasks" value={project.stats.totalTasks} />
          <MetricCard icon={CheckCircle2} label="Archived (Done)" value={project.stats.archivedTasks} />
          <MetricCard icon={Columns} label="Active Tasks" value={project.stats.activeTasks} />
          <MetricCard icon={AlertCircle} label="Overdue" value={project.stats.overdueTasks} />
          <MetricCard icon={Clock} label="Due This Week" value={project.stats.thisWeekTasks} />
        </section>

        <div className="grid min-h-0 gap-3 lg:flex-1 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.5fr)] lg:gap-4">
          <section className="flex min-h-0 flex-col rounded-xl border border-border bg-page-alt p-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Completion
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Archived task progress
                </p>
              </div>
              <span className="text-3xl font-semibold tracking-tight text-text-primary">
                {project.stats.completionRate}%
              </span>
            </div>
            <div className="mt-auto pt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${project.stats.completionRate}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                {project.stats.archivedTasks} of {project.stats.totalTasks} tasks archived
              </p>
            </div>
          </section>

          <section className="min-h-0 rounded-xl border border-border bg-page-alt p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Workflow distribution
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Tasks by board column
                </p>
              </div>
              <span className="rounded-full bg-bg-secondary px-2 py-1 text-[11px] font-medium text-text-secondary">
                {project.columns.length} columns
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {project.columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-bg-secondary px-3 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-text-primary">
                    {col.name}
                  </span>
                  <span className="ml-3 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-page-alt px-1.5 text-xs font-semibold text-text-secondary shadow-sm">
                    {col._count.tasks}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project name, description, or team area.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Project Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Description</label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Team Area</label>
              <Select value={editAreaId} onValueChange={setEditAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {areas?.map((a: { id: string; name: string }) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive &ldquo;{project.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This will archive the project and hide it from the main view. Tasks and documents will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Archive Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-page-alt p-3 shadow-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
        <Icon className="h-4.5 w-4.5 text-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none text-text-primary">{value}</p>
        <p className="mt-1 truncate text-[11px] text-text-secondary">{label}</p>
      </div>
    </div>
  );
}
