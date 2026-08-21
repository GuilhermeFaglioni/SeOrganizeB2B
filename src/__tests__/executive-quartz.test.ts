import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("Executive Quartz contracts", () => {
  it("uses the approved brand and named Balsa typography", () => {
    expect(read("src/lib/constants.ts")).toContain(
      'APP_NAME = "SeOrganize+"',
    );
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("createThemeScope");
    expect(layout).toContain('data-theme="se-organize-mais-design-system"');
    expect(layout).toContain('data-palette="se-organize-mais-design-system"');
    expect(layout).not.toContain("next/font/local");
    expect(layout).not.toContain("GeistVF.woff");
    expect(layout).toContain('default: "SeOrganize+"');
  });

  it("routes legacy utility names through the active Balsa palette", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toContain("--color-page: var(--color-balsa-background)");
    expect(globals).toContain("--color-sidebar: var(--color-balsa-inverse)");
    expect(globals).toContain("--color-accent: var(--color-balsa-primary)");
  });

  it("activates the Balsa theme and shadcn bridge at the application root", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toContain("balsa-shadcn-bridge.css");
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("BalsaThemeProvider");
    expect(layout).toContain("BalsaPortalScope");
    expect(read("src/components/ui/button.tsx")).toContain("bg-balsa");
  });

  it("uses reduced-motion-aware Motion transitions", () => {
    const page = read("src/components/shared/animated-page.tsx");
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(page).toContain('from "motion/react"');
    expect(page).toContain("useReducedMotion");
    expect(sidebar).toContain('layoutId="sidebar-active-route"');
  });
});
