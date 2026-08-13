import { useCallback, useEffect, useMemo, useState } from "react";
import { useClients } from "@/hooks/use-clients";
import { useProposals } from "@/hooks/use-proposals";
import { useContracts } from "@/hooks/use-contracts";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspace } from "@/hooks/use-proposals";

const STORAGE_KEY = "seorganize:onboarding";

export type OnboardingStep = "company" | "client" | "proposal" | "task";

export interface OnboardingState {
  /** Whether the wizard should be shown */
  showWizard: boolean;
  /** Current active step */
  currentStep: OnboardingStep;
  /** All steps with their completion status */
  steps: Array<{
    id: OnboardingStep;
    done: boolean;
    href: string;
  }>;
  /** Mark a step as done and advance to next */
  markStepDone: (step: OnboardingStep) => void;
  /** Skip the entire wizard */
  skip: () => void;
  /** Dismiss the wizard (same as skip, alias) */
  dismiss: () => void;
  /** Reset onboarding state (for testing) */
  reset: () => void;
  /** Whether the wizard was skipped */
  skipped: boolean;
  /** Progress percentage (0-100) */
  progress: number;
}

interface StoredState {
  skipped?: boolean;
  completedSteps?: OnboardingStep[];
}

function readStorage(): StoredState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
}

function writeStorage(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function useOnboarding(): OnboardingState {
  const [stored, setStored] = useState<StoredState>({});

  // Read from localStorage on mount
  useEffect(() => {
    setStored(readStorage());
  }, []);

  // Fetch data to derive completion — request minimal data
  const { data: clientsData } = useClients({ pageSize: 1, active: true });
  const { data: proposalsData } = useProposals({ pageSize: 1 });
  const { data: contractsData } = useContracts({ pageSize: 1 });
  const { data: projects } = useProjects();
  const { data: workspace } = useWorkspace();

  // Derive completion from real data
  const hasCompanyName = Boolean(workspace?.companyName?.trim());
  const hasClients = (clientsData?.items?.length ?? 0) > 0;
  const hasProposals = (proposalsData?.items?.length ?? 0) > 0;
  const hasContracts = (contractsData?.items?.length ?? 0) > 0;
  const hasProjects = (projects?.length ?? 0) > 0;

  // Check if any project has tasks (we check _count from projects)
  const hasTasks = hasProjects && (projects?.some((p) => (p._count?.tasks ?? 0) > 0) ?? false);

  // Merge derived state with stored completed steps
  const completedSteps = useMemo(() => {
    const done = new Set<OnboardingStep>(stored.completedSteps ?? []);

    // Auto-mark steps done based on real data
    if (hasCompanyName) done.add("company");
    if (hasClients) done.add("client");
    if (hasProposals || hasContracts) done.add("proposal");
    if (hasTasks) done.add("task");

    return done;
  }, [stored.completedSteps, hasCompanyName, hasClients, hasProposals, hasContracts, hasTasks]);

  // Determine current step (first incomplete)
  const allSteps: OnboardingStep[] = ["company", "client", "proposal", "task"];
  const currentStep = useMemo(() => {
    for (const step of allSteps) {
      if (!completedSteps.has(step)) return step;
    }
    return "task" as OnboardingStep; // all done
  }, [completedSteps]);

  // Steps with metadata
  const steps = useMemo(
    () =>
      allSteps.map((id) => ({
        id,
        done: completedSteps.has(id),
        href: getStepHref(id),
      })),
    [completedSteps]
  );

  // Show wizard if not skipped and not all steps done
  const allDone = allSteps.every((s) => completedSteps.has(s));
  const skipped = stored.skipped === true;
  const showWizard = !skipped && !allDone;

  // Progress
  const doneCount = allSteps.filter((s) => completedSteps.has(s)).length;
  const progress = Math.round((doneCount / allSteps.length) * 100);

  const markStepDone = useCallback(
    (step: OnboardingStep) => {
      const next = readStorage();
      const completed = new Set(next.completedSteps ?? []);
      completed.add(step);
      const updated: StoredState = { ...next, completedSteps: Array.from(completed) };
      writeStorage(updated);
      setStored(updated);
    },
    []
  );

  const skip = useCallback(() => {
    const next = readStorage();
    const updated: StoredState = { ...next, skipped: true };
    writeStorage(updated);
    setStored(updated);
  }, []);

  const reset = useCallback(() => {
    writeStorage({});
    setStored({});
  }, []);

  return {
    showWizard,
    currentStep,
    steps,
    markStepDone,
    skip,
    dismiss: skip,
    reset,
    skipped,
    progress,
  };
}

function getStepHref(step: OnboardingStep): string {
  switch (step) {
    case "company":
      return "/settings/workspace";
    case "client":
      return "/financial/clients/new";
    case "proposal":
      return "/financial/proposals/new";
    case "task":
      return "/projects";
  }
}
