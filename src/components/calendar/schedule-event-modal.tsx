"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScheduleEvent } from "@/hooks/use-calendar";

interface ScheduleEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
  taskDueDate?: string | null;
  taskId?: string;
}

export function ScheduleEventModal({ open, onOpenChange, taskTitle, taskDueDate, taskId }: ScheduleEventModalProps) {
  const [title, setTitle] = useState(taskTitle || "");
  const [date, setDate] = useState(taskDueDate ? taskDueDate.split("T")[0] : "");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [includeProject, setIncludeProject] = useState(false);

  const scheduleEvent = useScheduleEvent();

  useEffect(() => {
    if (taskTitle) setTitle(taskTitle);
    if (taskDueDate) setDate(taskDueDate.split("T")[0]);
  }, [taskTitle, taskDueDate, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(start.getTime() + parseInt(duration) * 60000);

    scheduleEvent.mutate(
      {
        title: title.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        taskId: taskId || undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule in Calendar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-date">Date</Label>
            <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-start">Start Time</Label>
              <Input id="event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-duration">Duration (min)</Label>
              <Input id="event-duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={15} step={15} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="include-project"
              type="checkbox"
              checked={includeProject}
              onChange={(e) => setIncludeProject(e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="include-project" className="text-sm">Include project name in title</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={scheduleEvent.isPending || !title.trim() || !date}>
              Schedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
