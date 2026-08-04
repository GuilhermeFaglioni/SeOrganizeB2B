import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync(
  new URL("../components/settings/settings-shell.tsx", import.meta.url),
  "utf8"
);

describe("settings UI primitives", () => {
  it("defines a responsive shared settings shell", () => {
    expect(shellSource).toContain('export function SettingsShell');
    expect(shellSource).toContain("min-h-full");
    expect(shellSource).toContain("max-w-5xl");
    expect(shellSource).toContain("sm:px-6");
  });

  it("provides reusable page structure primitives", () => {
    expect(shellSource).toContain('export function SettingsHeader');
    expect(shellSource).toContain('export function SettingsSection');
    expect(shellSource).toContain('export function SettingsBackLink');
  });
});
