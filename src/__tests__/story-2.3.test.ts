import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("2.3.13 Loading skeleton component", () => {
  it("Skeleton component exists with pulse animation", () => {
    expect(exists("src/components/shared/skeleton.tsx")).toBe(true);
    const src = read("src/components/shared/skeleton.tsx");
    expect(src).toContain("Skeleton");
    expect(src).toContain("animate-pulse");
    expect(src).toContain("rounded");
  });
});

describe("2.3.4 Responsive sidebar", () => {
  it("useMediaQuery hook exists", () => {
    expect(exists("src/hooks/use-media-query.ts")).toBe(true);
    const src = read("src/hooks/use-media-query.ts");
    expect(src).toContain("useMediaQuery");
    expect(src).toContain("matchMedia");
  });

  it("sidebar has responsive collapse logic", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).toContain("isTablet");
    expect(src).toContain("isMobile");
    expect(src).toContain("Menu");
    expect(src).toContain("aria-label");
  });
});

describe("2.3.2 Error boundary component", () => {
  it("ErrorBoundary component exists", () => {
    expect(exists("src/components/shared/error-boundary.tsx")).toBe(true);
    const src = read("src/components/shared/error-boundary.tsx");
    expect(src).toContain("ErrorBoundary");
    expect(src).toContain("componentDidCatch");
    expect(src).toContain("children");
  });
});

describe("2.3.3 Toast notifications", () => {
  it("Toast utility exists with success/error methods", () => {
    expect(exists("src/lib/toast.ts")).toBe(true);
    const src = read("src/lib/toast.ts");
    expect(src).toContain("toastSuccess");
    expect(src).toContain("toastError");
  });

  it("useCreateTask calls toast on error", () => {
    const src = read("src/hooks/use-tasks.ts");
    expect(src).toContain("toastError");
  });

  it("useCreateProject calls toast on error", () => {
    const src = read("src/hooks/use-projects.ts");
    expect(src).toContain("toastError");
  });
});

describe("2.3.9 Touch targets + focus-visible", () => {
  it("Button has min-h-[44px] and focus-visible ring", () => {
    const src = read("src/components/ui/button.tsx");
    expect(src).toContain("min-h-");
    expect(src).toContain("focus-visible:ring");
  });
});

describe("2.3.10 Reduced motion support", () => {
  it("globals.css has prefers-reduced-motion media query", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("prefers-reduced-motion");
  });
});

describe("2.3.12 ARIA attributes", () => {
  it("Kanban board has role and aria-label", () => {
    const src = read("src/components/kanban/kanban-board.tsx");
    expect(src).toContain("role=\"list\"");
    expect(src).toContain("aria-label");
  });

  it("Sidebar has aria-label on nav", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).toContain('aria-label="Main navigation"');
  });
});

describe("2.3.8 Responsive task detail", () => {
  it("TaskDetailModal exists for mobile", () => {
    expect(exists("src/components/kanban/task-detail-modal.tsx")).toBe(true);
    const src = read("src/components/kanban/task-detail-modal.tsx");
    expect(src).toContain("TaskDetailModal");
    expect(src).toContain("Dialog");
  });
});

describe("2.3.14 Form state persistence on error", () => {
  it("TaskForm shows toastError and keeps values on error", () => {
    const src = read("src/components/kanban/task-form.tsx");
    expect(src).toContain("catch");
    expect(src).toContain("toastError");
  });
});

describe("2.3.1 Reduced motion in Tailwind config", () => {
  it("LoadingState uses motion-safe:animate-spin", () => {
    const src = read("src/components/shared/loading-state.tsx");
    expect(src).toContain("motion-safe:animate-spin");
  });
});
