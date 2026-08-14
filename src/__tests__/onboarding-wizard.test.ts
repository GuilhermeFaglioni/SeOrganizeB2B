import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("onboarding wizard", () => {
  it("exports useOnboarding hook with required interface", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain("export type OnboardingStep");
    expect(hook).toContain("export interface OnboardingState");
    expect(hook).toContain("export function useOnboarding");
    expect(hook).toContain("showWizard");
    expect(hook).toContain("currentStep");
    expect(hook).toContain("markStepDone");
    expect(hook).toContain("skip");
    expect(hook).toContain("dismiss");
    expect(hook).toContain("reset");
    expect(hook).toContain("progress");
  });

  it("defines all 4 onboarding steps", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain('"company"');
    expect(hook).toContain('"client"');
    expect(hook).toContain('"proposal"');
    expect(hook).toContain('"task"');
  });

  it("derives step completion from real data hooks", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain("useClients");
    expect(hook).toContain("useProposals");
    expect(hook).toContain("useContracts");
    expect(hook).toContain("useProjects");
    expect(hook).toContain("useWorkspace");
  });

  it("persists state in localStorage", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain("localStorage.getItem");
    expect(hook).toContain("localStorage.setItem");
    expect(hook).toContain("seorganize:onboarding");
  });

  it("uses the persisted workspace completion to skip source-data loading", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain("workspace?.onboardingCompleted === true");
    expect(hook).toContain("enabled: shouldLoadOnboardingData");
    expect(hook).toContain('"/api/onboarding"');
    expect(hook).toContain('method: "POST"');
  });

  it("uses Array.from for Set iteration (TS2802 compat)", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain("Array.from(completed)");
  });

  it("links each step to the correct route", () => {
    const hook = read("src/hooks/use-onboarding.ts");
    expect(hook).toContain('"/settings/workspace"');
    expect(hook).toContain('"/financial/clients/new"');
    expect(hook).toContain('"/financial/proposals/new"');
    expect(hook).toContain('"/projects"');
  });

  it("shows wizard component on the today page", () => {
    const page = read("src/app/(authenticated)/app/page.tsx");
    expect(page).toContain("OnboardingWizard");
    expect(page).toContain('from "@/components/onboarding/onboarding-wizard"');
  });

  it("renders a progress bar with aria attributes", () => {
    const wizard = read("src/components/onboarding/onboarding-wizard.tsx");
    expect(wizard).toContain("role=\"progressbar\"");
    expect(wizard).toContain("aria-valuenow");
    expect(wizard).toContain("aria-valuemin");
    expect(hook_or_wizard()).toContain("aria-valuemax");
  });

  it("renders step list with icons and action buttons", () => {
    const wizard = read("src/components/onboarding/onboarding-wizard.tsx");
    expect(wizard).toContain("Building2");
    expect(wizard).toContain("Users");
    expect(wizard).toContain("FileText");
    expect(wizard).toContain("CheckSquare2");
    expect(wizard).toContain("ArrowRight");
  });

  it("provides a dismiss button", () => {
    const wizard = read("src/components/onboarding/onboarding-wizard.tsx");
    expect(wizard).toContain('dismiss');
    expect(wizard).toContain("X");
  });

  it("uses i18n for all user-facing text", () => {
    const wizard = read("src/components/onboarding/onboarding-wizard.tsx");
    expect(wizard).toContain('useTranslations("onboarding.wizard")');
    expect(wizard).toContain('t("title")');
    expect(wizard).toContain('t("subtitle")');
    expect(wizard).toContain('t("dismiss")');
  });
});

describe("empty states with onboarding CTAs", () => {
  it("enhances FinancialEmptyState with optional action link", () => {
    const empty = read("src/components/financial/shared/empty-state.tsx");
    expect(empty).toContain("action");
    expect(empty).toContain("href");
    expect(empty).toContain("ArrowRight");
    expect(empty).toContain('role="status"');
  });

  it("client list shows onboarding empty state with CTA", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("emptyTitle");
    expect(list).toContain("emptyHint");
    expect(list).toContain("emptyAction");
  });

  it("proposal list shows onboarding empty state with CTA", () => {
    const list = read("src/components/financial/proposals/proposal-list.tsx");
    expect(list).toContain("emptyTitle");
    expect(list).toContain("emptyHint");
    expect(list).toContain("emptyAction");
  });

  it("contract list shows onboarding empty state with CTA", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("emptyTitle");
    expect(list).toContain("emptyHintDefault");
    expect(list).toContain("emptyAction");
  });

  it("contract list preserves search hint in empty state", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("hint={filters.search");
  });

  it("today tasks shows onboarding link when empty", () => {
    const tasks = read("src/components/today/today-tasks.tsx");
    expect(tasks).toContain("emptyAction");
    expect(tasks).toContain("ArrowRight");
  });
});

function hook_or_wizard(): string {
  return read("src/components/onboarding/onboarding-wizard.tsx");
}
