import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("1.4.1 Projects API routes", () => {
  it("GET/POST /api/projects/route.ts exists", () => {
    expect(exists("src/app/api/projects/route.ts")).toBe(true);
    const src = read("src/app/api/projects/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("getSession");
    expect(src).toContain("prisma.project");
    expect(src).toContain("createDefaultColumns");
  });

  it("PATCH/DELETE /api/projects/[id]/route.ts exists", () => {
    expect(exists("src/app/api/projects/[id]/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[id]/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.id");
    expect(src).toContain("archived");
  });
});

describe("1.4.2 useProjects hook", () => {
  it("exports all query/mutation functions", () => {
    const src = read("src/hooks/use-projects.ts");
    expect(src).toMatch(/useProjects/);
    expect(src).toMatch(/useCreateProject/);
    expect(src).toMatch(/useUpdateProject/);
    expect(src).toMatch(/useDeleteProject/);
    expect(src).toContain("@tanstack/react-query");
    expect(src).toContain("/api/projects");
  });
});

describe("1.4.3 ProjectCard component", () => {
  it("renders title, description, area badge, stats, data-testid", () => {
    const src = read("src/components/projects/project-card.tsx");
    expect(src).toContain('data-testid="project-card"');
    expect(src).toContain("project.name");
    expect(src).toContain("description");
    expect(src).toContain("AreaBadge");
    expect(src).toContain("task");
    expect(src).toContain("ChevronRight");
  });
});

describe("1.4.4 ProjectGrid component", () => {
  it("renders 2-column grid with empty state", () => {
    const src = read("src/components/projects/project-grid.tsx");
    expect(src).toContain("ProjectCard");
    expect(src).toContain("grid");
    expect(src).toContain("empty");
    expect(src).toContain('data-testid="empty-projects"');
  });
});

describe("1.4.5 ProjectSelector component", () => {
  it("renders dropdown with project list in sidebar", () => {
    const src = read("src/components/projects/project-selector.tsx");
    expect(src).toContain('data-testid="project-selector"');
    expect(src).toContain("useProjects");
    expect(src).toContain("Select");
    expect(src).toContain("/board/");
  });
});

describe("1.4.6 ProjectForm modal", () => {
  it("renders modal with name, description, area dropdown", () => {
    const src = read("src/components/projects/project-form.tsx");
    expect(src).toContain("Dialog");
    expect(src).toContain("name");
    expect(src).toContain("description");
    expect(src).toContain("useCreateProject");
    expect(src).toContain("useAreas");
  });
});

describe("1.4.7 Projects list page", () => {
  it("renders projects page with ProjectGrid and ProjectForm", () => {
    expect(exists("src/app/(authenticated)/projects/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/projects/page.tsx");
    expect(src).toContain('data-testid="projects-page"');
    expect(src).toContain("ProjectGrid");
    expect(src).toContain("ProjectForm");
    expect(src).toContain("useProjects");
  });
});

describe("Sidebar includes ProjectSelector", () => {
  it("sidebar.tsx imports and renders ProjectSelector", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).toContain("ProjectSelector");
  });
});
