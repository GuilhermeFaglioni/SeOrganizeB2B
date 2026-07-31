import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("Executive Quartz contracts", () => {
  it("uses the approved brand and local Geist fonts", () => {
    expect(read("src/lib/constants.ts")).toContain(
      'APP_NAME = "SeOrganize+"',
    );
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("next/font/local");
    expect(layout).toContain("GeistVF.woff");
    expect(layout).toContain('default: "SeOrganize+"');
  });

  it("defines the approved color foundations", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toContain("--color-page: #F4F7FB");
    expect(globals).toContain("--color-sidebar: #10233F");
    expect(globals).toContain("--color-accent: #2F6FED");
  });

  it("uses reduced-motion-aware Motion transitions", () => {
    const page = read("src/components/shared/animated-page.tsx");
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(page).toContain('from "motion/react"');
    expect(page).toContain("useReducedMotion");
    expect(sidebar).toContain('layoutId="sidebar-active-route"');
  });
});
