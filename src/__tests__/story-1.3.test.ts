import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("1.3.1 Areas API routes", () => {
  it("GET/POST /api/areas/route.ts exists", () => {
    expect(exists("src/app/api/areas/route.ts")).toBe(true);
    const src = read("src/app/api/areas/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("getUser");
    expect(src).toContain("prisma.teamArea");
  });

  it("PATCH/DELETE /api/areas/[id]/route.ts exists", () => {
    expect(exists("src/app/api/areas/[id]/route.ts")).toBe(true);
    const src = read("src/app/api/areas/[id]/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.id");
  });

  it("GET /api/areas/[id]/impact/route.ts exists", () => {
    expect(exists("src/app/api/areas/[id]/impact/route.ts")).toBe(true);
    const src = read("src/app/api/areas/[id]/impact/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("tasks");
    expect(src).toContain("projects");
  });
});

describe("1.3.2 useAreas hook", () => {
  it("exports all 5 query/mutation functions", () => {
    const src = read("src/hooks/use-areas.ts");
    expect(src).toMatch(/useAreas/);
    expect(src).toMatch(/useCreateArea/);
    expect(src).toMatch(/useUpdateArea/);
    expect(src).toMatch(/useDeleteArea/);
    expect(src).toMatch(/useAreaImpact/);
    expect(src).toContain("@tanstack/react-query");
  });
});

describe("1.3.3 AreaBadge component", () => {
  it("renders pill with colored dot and name", () => {
    const src = read("src/components/areas/area-badge.tsx");
    expect(src).toContain('data-testid="area-badge"');
    expect(src).toContain("name");
    expect(src).toContain("color");
    expect(src).toContain("compact");
  });
});

describe("1.3.4 AreaFilter component", () => {
  it("renders checkbox list for sidebar", () => {
    const src = read("src/components/areas/area-filter.tsx");
    expect(src).toContain('data-testid="area-filter"');
    expect(src).toContain("areas");
    expect(src).toContain("selected");
    expect(src).toContain("onToggle");
    expect(src).toContain("Checkbox");
  });
});

describe("1.3.5 AreaList component", () => {
  it("renders table with name, stats, edit/delete buttons", () => {
    const src = read("src/components/areas/area-list.tsx");
    expect(src).toContain('data-testid="area-list"');
    expect(src).toContain("useAreas");
    expect(src).toContain("useAreaImpact");
    expect(src).toContain("onEdit");
    expect(src).toContain("onDelete");
  });
});

describe("1.3.6 Settings areas page", () => {
  it("renders settings areas page with correct test id", () => {
    expect(exists("src/app/(authenticated)/settings/areas/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/settings/areas/page.tsx");
    expect(src).toContain('data-testid="areas-settings-page"');
    expect(src).toContain("AreaList");
    expect(src).toContain("area");
  });

  it("renders Add Area modal with data-testid add-area-modal and name validation", () => {
    const src = read("src/app/(authenticated)/settings/areas/page.tsx");
    expect(src).toContain('data-testid="add-area-modal"');
    expect(src).toContain("Dialog");
    expect(src).toContain("useCreateArea");
    expect(src).toContain("Input");
    expect(src).toContain("name");
  });

  it("renders Delete Area modal with data-testid delete-area-modal and impact count", () => {
    const src = read("src/app/(authenticated)/settings/areas/page.tsx");
    expect(src).toContain('data-testid="delete-area-modal"');
    expect(src).toContain("impact");
    expect(src).toContain("tasks");
    expect(src).toContain("projects");
    expect(src).toContain("useAreaImpact");
    expect(src).toContain("destructive");
  });
});

describe("1.3.7 Sidebar area filter", () => {
  it("keeps TeamArea filtering out of the global sidebar", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).not.toContain("AreaFilter");
    expect(src).not.toContain("useAreas");
    expect(read("src/components/board/board-controls.tsx")).toContain(
      't("teamArea")'
    );
  });
});
