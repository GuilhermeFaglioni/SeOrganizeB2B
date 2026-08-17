"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Link2,
  Mail,
  Users,
} from "lucide-react";
import type { CalendarEventData } from "@/lib/calendar/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useUpdateCalendarEvent, useDeleteCalendarEvent } from "@/hooks/use-calendar";
import { useCan } from "@/hooks/use-permissions";
import { toastError, toastSuccess } from "@/lib/toast";

const NONE = "__none__";

interface TaskOption {
  id: string;
  title: string;
}

export function EventDetailModal({
  event,
  open,
  onOpenChange,
}: {
  event: CalendarEventData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: projects = [] } = useProjects();
  const { data: areas = [] } = useAreas();
  const t = useTranslations("calendar.eventDetail");
  const { can } = useCan();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState(NONE);
  const [areaId, setAreaId] = useState(NONE);
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isReadOnly = Boolean(event?.googleId && event.id === event.googleId);
  const { data: tasks = [] } = useQuery<TaskOption[]>({
    queryKey: ["calendar-link-tasks", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Failed to load tasks");
      }
      return payload.data;
    },
  });

  useEffect(() => {
    if (!event) return;
    setProjectId(event.task?.project?.id || "");
    setTaskId(event.task?.id || NONE);
    setAreaId(event.area?.id || NONE);
  }, [event]);

  if (!event) return null;
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const internalAttendees = event.attendees.filter(
    (attendee) => attendee.profileId
  );
  const externalAttendees = event.attendees.filter(
    (attendee) => !attendee.profileId
  );

  async function saveLinks() {
    try {
      await updateEvent.mutateAsync({
        id: event!.id,
        taskId: taskId === NONE ? null : taskId,
        areaId: areaId === NONE ? null : areaId,
      });
      toastSuccess(t("toastLinksUpdated"));
      onOpenChange(false);
    } catch {
      toastError(
        t("toastUpdateFailed"),
        t("toastUpdateFailed"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            {event.source === "google" ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            {event.source === "google" ? "Google Calendar" : t("sourceLocal")}
          </div>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {event.allDay
              ? t("allDayDate", {
                  date: start.toLocaleDateString("pt-BR"),
                })
              : t("dateRange", {
                  start: start.toLocaleString("pt-BR"),
                  end: end.toLocaleString("pt-BR"),
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-page-alt p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("description")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">
              {event.description || t("noDescription")}
            </p>
            {event.timeZone && (
              <p className="mt-3 text-xs text-text-secondary">
                {t("timeZone", { timeZone: event.timeZone })}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-accent" /> {t("internalAttendees")}
              </p>
              {internalAttendees.length ? (
                <ul className="space-y-2 text-sm text-text-secondary">
                  {internalAttendees.map((attendee) => (
                    <li key={attendee.id || attendee.email}>
                      {attendee.displayName || attendee.email}
                      <span className="ml-2 text-xs">· {attendee.responseStatus}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t("noInternalAttendees")}</p>
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-accent" /> {t("externalAttendees")}
              </p>
              {externalAttendees.length ? (
                <ul className="space-y-2 text-sm text-text-secondary">
                  {externalAttendees.map((attendee) => (
                    <li key={attendee.id || attendee.email}>{attendee.email}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t("noExternalAttendees")}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-accent" /> {t("links")}
            </p>
            {isReadOnly ? (
              <p className="text-sm text-text-secondary">
                {t("readOnlyHint")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("taskProject")}</Label>
                  <Select
                    value={projectId || NONE}
                    onValueChange={(value) => {
                      setProjectId(value === NONE ? "" : value);
                      setTaskId(NONE);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("projectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("noTask")}</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("task")}</Label>
                  <Select
                    value={taskId}
                    onValueChange={setTaskId}
                    disabled={!projectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("taskPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("noTask")}</SelectItem>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("teamArea")}</Label>
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("teamAreaPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("noArea")}</SelectItem>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <DialogFooter className="gap-2">
            {confirmDelete ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("keep")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await deleteEvent.mutateAsync(event!.id);
                      toastSuccess(t("toastDeleted"));
                      setConfirmDelete(false);
                      onOpenChange(false);
                     } catch {
                      toastError(
                        t("toastDeleteFailed"),
                        t("toastDeleteFailed"),
                      );
                    }
                  }}
                  disabled={deleteEvent.isPending}
                >
                  {deleteEvent.isPending
                    ? t("deleting")
                    : t("confirmDelete")}
                </Button>
              </>
            ) : (
              <>
                {can("calendar.delete") && (
                <Button
                  variant="outline"
                  className="text-danger hover:text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  {t("delete")}
                </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={saveLinks} disabled={updateEvent.isPending || !can("calendar.edit")}>
                  {updateEvent.isPending ? t("saving") : t("saveLinks")}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
