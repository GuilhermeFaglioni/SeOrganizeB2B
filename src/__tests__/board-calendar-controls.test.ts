import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("task form viewport regression", () => {
  it("uses a wide responsive dialog with internal scrolling", () => {
    const source = read("src/components/kanban/task-form.tsx");
    expect(source).toContain("sm:max-w-3xl");
    expect(source).toContain("max-h-[90vh]");
    expect(source).toContain("lg:grid-cols-2");
  });
});

describe("calendar event details", () => {
  it("opens an application detail dialog when an event is clicked", () => {
    const source = read("src/components/calendar/calendar-view.tsx");
    expect(source).toContain("EventDetailModal");
    expect(source).toContain("setSelectedEvent");
  });

  it("supports owned task and team-area association", () => {
    const route = read("src/app/api/calendar/events/[id]/route.ts");
    expect(route).toContain("export async function PATCH");
    expect(route).toContain("areaId");
    expect(read("prisma/schema.prisma")).toContain(
      "areaId      String?  @map(\"area_id\")"
    );
  });
});

describe("saved views and board controls", () => {
  it("uses an internal save dialog instead of browser prompt", () => {
    const source = read("src/components/board/saved-view-control.tsx");
    expect(source).not.toContain("window.prompt");
    expect(source).toContain("DialogTitle");
    expect(source).toContain("saveViewOpen");
  });

  it("mounts advanced URL-backed Board controls", () => {
    const source = read("src/app/(authenticated)/board/page.tsx");
    expect(source).toContain("BoardControls");
    expect(source).toContain('searchParams.get("assignee")');
    expect(source).toContain('searchParams.get("dateFrom")');
    expect(source).toContain('searchParams.get("sort")');
    expect(source).toContain('searchParams.get("group")');
  });

  it("keeps board controls inside a dismissible filter popover", () => {
    const source = read("src/components/board/board-controls.tsx");
    expect(source).toContain("PopoverTrigger");
    expect(source).toContain("PopoverContent");
    expect(source).toContain('t("filters")');
    expect(source).toContain("activeControlCount");
  });

  it("removes team-area filtering from the sidebar", () => {
    expect(read("src/components/layout/sidebar.tsx")).not.toContain(
      "AreaFilter"
    );
  });
});
