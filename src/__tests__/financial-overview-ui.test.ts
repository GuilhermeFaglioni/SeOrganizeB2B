import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("financial overview UI", () => {
  it("adds a Financial entry to the sidebar navigation", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(sidebar).toContain('href: "/financial"');
    expect(sidebar).toContain('label: "Financial"');
    expect(sidebar).toContain("nav-financial");
  });

  it("keeps the overview route and layout present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/page.tsx",
      "src/app/(authenticated)/financial/layout.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders the forecast versus received chart accessibly", () => {
    const chart = read("src/components/financial/overview/forecast-received-chart.tsx");
    expect(chart).toContain("role=\"img\"");
    expect(chart).toContain("aria-label");
    expect(chart).toContain("svg");
  });

  it("exposes KPI cards with labels and money formatting", () => {
    const kpi = read("src/components/financial/shared/kpi-card.tsx");
    expect(kpi).toContain("formatBRL");
    expect(kpi).toContain("aria-label");
  });

  it("passes global filters to the overview query", () => {
    const page = read("src/app/(authenticated)/financial/page.tsx");
    expect(page).toContain("<OverviewPage");
  });
});
