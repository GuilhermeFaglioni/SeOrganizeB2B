"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QuickCaptureDialog } from "@/components/quick-capture/quick-capture-dialog";

interface QuickCaptureContextValue {
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
}

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

export function QuickCaptureProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openQuickCapture = useCallback(() => setOpen(true), []);
  const closeQuickCapture = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      event.preventDefault();
      openQuickCapture();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openQuickCapture]);

  const value = useMemo(
    () => ({ openQuickCapture, closeQuickCapture }),
    [openQuickCapture, closeQuickCapture]
  );
  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCaptureContext() {
  const context = useContext(QuickCaptureContext);
  if (!context) {
    throw new Error("useQuickCapture must be used inside QuickCaptureProvider");
  }
  return context;
}
