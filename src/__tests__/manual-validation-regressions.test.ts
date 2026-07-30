import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

describe("manual validation regressions", () => {
  it("keeps document and calendar content inside the viewport", () => {
    expect(read("src/components/shared/animated-page.tsx")).toContain(
      'className="h-full min-h-0"'
    );
    expect(read("src/app/(authenticated)/calendar/page.tsx")).not.toContain(
      "min-h-[760px]"
    );
    expect(read("src/components/calendar/calendar-view.tsx")).not.toContain(
      "min-h-[680px]"
    );
  });

  it("fits the desktop project dashboard inside the application viewport", () => {
    const project = read(
      "src/app/(authenticated)/projects/[projectId]/page.tsx"
    );
    expect(project).toContain("h-full overflow-hidden");
    expect(project).toContain("max-w-7xl");
    expect(project).toContain("lg:grid-cols-5");
    expect(project).toContain("lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.5fr)]");
    expect(project).not.toContain("max-w-4xl");
  });

  it("uses the DnD board in every project section", () => {
    const board = read("src/app/(authenticated)/board/page.tsx");
    expect(board).toContain("<KanbanBoard");
    expect(board).toContain('mode="compact"');
  });

  it("removes global project state and remembered routing", () => {
    expect(read("src/components/layout/sidebar.tsx")).not.toContain(
      "ProjectSelector"
    );
    expect(read("src/app/(authenticated)/layout.tsx")).not.toContain(
      "ProjectProvider"
    );
    expect(read("src/components/layout/app-layout.tsx")).not.toContain(
      "lastProjectId"
    );
  });

  it("renders one editor line break as one preview line break", () => {
    expect(read("src/components/documents/markdown-preview.tsx")).toContain(
      "remarkBreaks"
    );
  });
});
