import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

describe("mobile layout regressions", () => {
  it("places the mobile menu trigger in the topbar flow", () => {
    const appLayout = read("src/components/layout/app-layout.tsx");
    const topbar = read("src/components/layout/topbar.tsx");
    const sidebar = read("src/components/layout/sidebar.tsx");

    expect(appLayout).toContain("mobileMenuOpen");
    expect(appLayout).toContain("onMenuClick");
    expect(topbar).toContain("Menu");
    expect(topbar).toContain('aria-label="Open menu"');
    expect(topbar).toContain("min-w-0");
    expect(topbar).toContain("truncate");
    expect(sidebar).toContain("mobileOpen");
    expect(sidebar).not.toContain("fixed top-3 left-3");
  });

  it("keeps document save available as an accessible mobile icon action", () => {
    const editor = read("src/components/documents/document-editor.tsx");

    expect(editor).toContain('aria-label="Save document"');
    expect(editor).toContain('title="Save document"');
    expect(editor).toContain("sm:hidden");
  });

  it("turns the task detail into a full mobile sheet below the topbar", () => {
    const panel = read("src/components/kanban/task-detail-panel.tsx");

    expect(panel).toContain("fixed inset-x-0 top-14 bottom-0");
    expect(panel).toContain("sm:static");
    expect(panel).toContain("sm:w-[400px]");
    expect(panel).toContain("overflow-y-auto");
  });

  it("uses the dynamic viewport and protects fixed bottom surfaces", () => {
    const appLayout = read("src/components/layout/app-layout.tsx");
    const sidebar = read("src/components/layout/sidebar.tsx");
    const toast = read("src/components/ui/toast.tsx");

    expect(appLayout).toContain("min-h-[100dvh]");
    expect(sidebar).toContain("safe-area-inset-bottom");
    expect(toast).toContain("safe-area-inset-bottom");
  });
});
