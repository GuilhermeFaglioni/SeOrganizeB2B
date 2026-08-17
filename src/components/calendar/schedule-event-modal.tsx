"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScheduleEvent } from "@/hooks/use-calendar";
import { useTranslations } from "next-intl";
import { EventAttendeeSelector } from "./event-attendee-selector";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  useCalendarConflicts,
  type CalendarConflict,
} from "@/hooks/use-calendar-conflicts";
import { AlertTriangle } from "lucide-react";
import { useAreas } from "@/hooks/use-areas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
  taskDueDate?: string | null;
  taskId?: string;
  startDate?: string;
  initialAllDay?: boolean;
  initialProfileIds?: string[];
}

function todayValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function ScheduleEventModal({
  open,
  onOpenChange,
  taskTitle,
  taskDueDate,
  taskId,
  startDate,
  initialAllDay,
  initialProfileIds,
}: ScheduleEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayValue());
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [allDay, setAllDay] = useState(false);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([]);
  const [areaId, setAreaId] = useState("");
  const t = useTranslations("calendar.scheduleEvent");
  const scheduleEvent = useScheduleEvent();
  const { data: areas = [] } = useAreas();
  const conflictCheck = useCalendarConflicts();
  const [conflicts, setConflicts] = useState<CalendarConflict[] | null>(null);
  const [conflictCheckUnavailable, setConflictCheckUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(taskTitle ?? "");
    setDescription("");
    setDate(
      startDate?.slice(0, 10) ??
        taskDueDate?.slice(0, 10) ??
        todayValue(),
    );
    setAllDay(initialAllDay ?? false);
    setProfileIds(initialProfileIds ?? []);
    setAttendeeEmails([]);
    setAreaId("");
    setConflicts(null);
    setConflictCheckUnavailable(false);
  }, [
    initialAllDay,
    initialProfileIds,
    open,
    startDate,
    taskDueDate,
    taskTitle,
  ]);

  useEffect(() => {
    setConflicts(null);
    setConflictCheckUnavailable(false);
  }, [allDay, date, duration, startTime]);

  function eventRange() {
    let eventStart: string;
    let eventEnd: string;
    if (allDay) {
      const nextDay = new Date(`${date}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      eventStart = date;
      eventEnd = nextDay.toISOString().slice(0, 10);
    } else {
      const start = new Date(`${date}T${startTime}:00`);
      const minutes = Number.parseInt(duration, 10);
      const end = new Date(start.getTime() + minutes * 60_000);
      eventStart = start.toISOString();
      eventEnd = end.toISOString();
    }
    return { eventStart, eventEnd };
  }

  function createEvent(eventStart: string, eventEnd: string) {
    scheduleEvent.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: eventStart,
        endTime: eventEnd,
        allDay,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        taskId,
        areaId: areaId || undefined,
        profileIds,
        attendeeEmails,
      },
      {
        onSuccess: (createdEvent) => {
          toastSuccess(
            taskId
              ? t("toastTaskScheduled")
              : createdEvent.source === "google"
                ? t("toastEventSynced")
                : t("toastEventSavedLocal"),
            createdEvent.source === "google"
              ? attendeeEmails.length + profileIds.length > 0
                ? t("toastInvitesSent")
                : t("toastCreatedGoogle")
              : t("toastConnectGoogle"),
          );
          onOpenChange(false);
        },
        onError: () => {
          toastError(
            t("toastCreateFailed"),
            t("toastCreateFailed"),
          );
        },
      },
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !date) return;
    const { eventStart, eventEnd } = eventRange();
    if (conflicts !== null || conflictCheckUnavailable) {
      createEvent(eventStart, eventEnd);
      return;
    }
    try {
      const result = await conflictCheck.mutateAsync({
        startTime: eventStart,
        endTime: eventEnd,
      });
      if (result.conflicts.length || result.googleStatus === "unavailable") {
        setConflicts(result.conflicts);
        setConflictCheckUnavailable(result.googleStatus === "unavailable");
        return;
      }
      createEvent(eventStart, eventEnd);
    } catch {
      setConflicts([]);
      setConflictCheckUnavailable(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="event-title">{t("titleLabel")}</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("titlePlaceholder")}
              autoFocus
            />
          </div>
          {(conflicts !== null || conflictCheckUnavailable) && (
            <div className="rounded-xl border border-warning/30 bg-warning-bg p-3 text-sm text-text-primary">
              <div className="flex gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {conflicts?.length
                  ? t("conflictsFound", { count: conflicts.length })
                  : t("conflictsUnavailable")}
              </div>
              {!!conflicts?.length && (
                <ul className="mt-2 space-y-1 pl-6 text-xs text-text-secondary">
                  {conflicts.map((conflict) => (
                    <li key={`${conflict.source}-${conflict.id}`}>
                      {conflict.title} ·{" "}
                      {new Date(conflict.startTime).toLocaleString("pt-BR")}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-text-secondary">
                {t("warningDoesNotBlock")}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="event-description">{t("descriptionLabel")}</Label>
            <textarea
              id="event-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="flex w-full rounded-md border border-border bg-page-alt px-3 py-2 text-sm outline-none transition-shadow placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="event-all-day"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(checked === true)}
            />
            <Label htmlFor="event-all-day">{t("allDay")}</Label>
          </div>
          <div className={allDay ? "grid gap-4" : "grid grid-cols-2 gap-4"}>
            <div className="space-y-2">
              <Label htmlFor="event-date">{t("date")}</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="event-start">{t("start")}</Label>
                <Input
                  id="event-start"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
            )}
          </div>
          {!allDay && (
            <div className="space-y-2">
              <Label htmlFor="event-duration">{t("duration")}</Label>
              <Input
                id="event-duration"
                type="number"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                min={15}
                step={15}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("attendees")}</Label>
            <EventAttendeeSelector
              profileIds={profileIds}
              attendeeEmails={attendeeEmails}
              onProfileIdsChange={setProfileIds}
              onAttendeeEmailsChange={setAttendeeEmails}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("teamArea")}</Label>
            <Select
              value={areaId || "__none__"}
              onValueChange={(value) =>
                setAreaId(value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("linkTeamArea")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noTeamArea")}</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                scheduleEvent.isPending ||
                conflictCheck.isPending ||
                !title.trim() ||
                !date
              }
            >
              {scheduleEvent.isPending
                ? t("scheduling")
                : conflictCheck.isPending
                  ? t("checking")
                  : conflicts !== null || conflictCheckUnavailable
                    ? t("createAnyway")
                    : t("schedule")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
