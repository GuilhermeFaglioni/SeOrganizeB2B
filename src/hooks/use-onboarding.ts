import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClients } from "@/hooks/use-clients";
import { useProposals } from "@/hooks/use-proposals";
import { useContracts } from "@/hooks/use-contracts";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspace, type WorkspaceData } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/financial/http";

const STORAGE_KEY = "seorganize:onboarding";

export type OnboardingStep = "company" | "client" | "proposal" | "task";

const ALL_STEPS: OnboardingStep[] = ["company", "client", "proposal", "task"];

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
  const queryClient = useQueryClient();
  const completionRequested = useRef(false);

  // Read from localStorage on mount
  useEffect(() => {
    setStored(readStorage());
  }, []);

  const { data: workspace } = useWorkspace();
  const onboardingCompleted = workspace?.onboardingCompleted === true;
  const shouldLoadOnboardingData = !onboardingCompleted;

  // Do not load source data after the workspace has a persisted completion flag.
  const { data: clientsData } = useClients(
    { pageSize: 1, active: true },
    { enabled: shouldLoadOnboardingData },
  );
  const { data: proposalsData } = useProposals(
    { pageSize: 1 },
    { enabled: shouldLoadOnboardingData },
  );
  const { data: contractsData } = useContracts(
    { pageSize: 1 },
    { enabled: shouldLoadOnboardingData },
  );
  const { data: projects } = useProjects({ enabled: shouldLoadOnboardingData });

  // Derive completion from real data
  const hasCompanyName = Boolean(workspace?.companyName?.trim());
  const hasClients = (clientsData?.items?.length ?? 0) > 0;
  const hasProposals = (proposalsData?.items?.length ?? 0) > 0;
  const hasContracts = (contractsData?.items?.length ?? 0) > 0;
  const hasProjects = (projects?.length ?? 0) > 0;

  // Check if any project has tasks (we check _count from projects)
  const hasTasks = hasProjects && (projects?.some((p) => (p._count?.tasks ?? 0) > 0) ?? false);
  const dataComplete =
    hasCompanyName &&
    hasClients &&
    (hasProposals || hasContracts) &&
    hasTasks;

  const completeOnboarding = useMutation({
    mutationFn: () =>
      fetchJson<{ onboardingCompleted: boolean }>("/api/onboarding", {
        method: "POST",
      }),
    onSuccess: (result) => {
      if (!result.onboardingCompleted) return;
      queryClient.setQueryData<WorkspaceData>(["workspace"], (current) =>
        current ? { ...current, onboardingCompleted: true } : current,
      );
    },
    onError: () => {
      completionRequested.current = false;
    },
  });
  const completeOnboardingRequest = completeOnboarding.mutate;

  useEffect(() => {
    if (
      !dataComplete ||
      onboardingCompleted ||
      completionRequested.current
    ) {
      return;
    }

    completionRequested.current = true;
    completeOnboardingRequest();
  }, [dataComplete, onboardingCompleted, completeOnboardingRequest]);

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
  const currentStep = useMemo(() => {
    for (const step of ALL_STEPS) {
      if (!completedSteps.has(step)) return step;
    }
    return "task" as OnboardingStep; // all done
  }, [completedSteps]);

  // Steps with metadata
  const steps = useMemo(
    () =>
      ALL_STEPS.map((id) => ({
        id,
        done: completedSteps.has(id),
        href: getStepHref(id),
      })),
    [completedSteps]
  );

  // Show wizard only while it is neither dismissed nor persisted as complete.
  const allDone = ALL_STEPS.every((s) => completedSteps.has(s));
  const skipped = stored.skipped === true;
  const showWizard = !skipped && !onboardingCompleted && !allDone;

  // Progress
  const doneCount = ALL_STEPS.filter((s) => completedSteps.has(s)).length;
  const progress = Math.round((doneCount / ALL_STEPS.length) * 100);

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
