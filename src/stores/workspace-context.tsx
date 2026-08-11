"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import type { WorkspaceData } from "@/hooks/use-workspace";

interface WorkspaceContextValue {
  workspace: WorkspaceData | null;
  readOnly: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  readOnly: false,
});

export function WorkspaceProvider({
  workspace,
  readOnly,
  children,
}: {
  workspace: WorkspaceData | null;
  readOnly: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ workspace, readOnly }),
    [workspace, readOnly]
  );
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}