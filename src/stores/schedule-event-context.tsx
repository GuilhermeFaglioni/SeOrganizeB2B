"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ScheduleEventModal } from "@/components/calendar/schedule-event-modal";

export interface ScheduleEventDraft {
  taskId?: string;
  taskTitle?: string;
  taskDueDate?: string | null;
  startDate?: string;
  allDay?: boolean;
  profileIds?: string[];
}

interface ScheduleEventContextValue {
  openScheduleEvent: (draft?: ScheduleEventDraft) => void;
  closeScheduleEvent: () => void;
}

const ScheduleEventContext = createContext<ScheduleEventContextValue | null>(
  null,
);

export function ScheduleEventProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleEventDraft>({});

  const openScheduleEvent = useCallback((nextDraft: ScheduleEventDraft = {}) => {
    setDraft(nextDraft);
    setOpen(true);
  }, []);
  const closeScheduleEvent = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ openScheduleEvent, closeScheduleEvent }),
    [closeScheduleEvent, openScheduleEvent],
  );

  return (
    <ScheduleEventContext.Provider value={value}>
      {children}
      <ScheduleEventModal
        open={open}
        onOpenChange={setOpen}
        taskTitle={draft.taskTitle}
        taskDueDate={draft.taskDueDate}
        taskId={draft.taskId}
        startDate={draft.startDate}
        initialAllDay={draft.allDay}
        initialProfileIds={draft.profileIds}
      />
    </ScheduleEventContext.Provider>
  );
}

export function useScheduleEventDialog() {
  const context = useContext(ScheduleEventContext);
  if (!context) {
    throw new Error(
      "useScheduleEventDialog must be used inside ScheduleEventProvider",
    );
  }
  return context;
}
