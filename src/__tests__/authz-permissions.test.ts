import { describe, expect, it } from "vitest";
import {
  allPermissions,
  hasFinancialView,
  isValidPermission,
  sanitizePermissions,
  MODULES,
  SPECIAL_PERMISSIONS,
} from "../lib/authz/permissions";

describe("permission catalog", () => {
  it("builds module permission keys", () => {
    const perms = allPermissions();
    expect(perms).toContain("tasks.view");
    expect(perms).toContain("tasks.create");
    expect(perms).toContain("financial.contracts.delete");
    expect(perms).toContain("financial.overview.view");
  });

  it("includes all special permissions", () => {
    const perms = allPermissions();
    for (const special of SPECIAL_PERMISSIONS) {
      expect(perms).toContain(special);
    }
  });

  it("validates permission keys", () => {
    expect(isValidPermission("tasks.view")).toBe(true);
    expect(isValidPermission("financial.proposals.send")).toBe(true);
    expect(isValidPermission("manage_roles")).toBe(true);
    expect(isValidPermission("bogus.thing")).toBe(false);
    expect(isValidPermission("tasks.viewX")).toBe(false);
  });

  it("sanitizes an array of permissions", () => {
    const cleaned = sanitizePermissions([
      "tasks.view",
      "tasks.view",
      "nope",
      42,
      "financial.receivables.refund",
    ]);
    expect(cleaned).toEqual(["tasks.view", "financial.receivables.refund"]);
  });

  it("detects financial view from a permission list", () => {
    expect(hasFinancialView(["financial.contracts.view"])).toBe(true);
    expect(hasFinancialView(["tasks.view"])).toBe(false);
    expect(hasFinancialView([])).toBe(false);
  });

  it("financial.overview is view-only", () => {
    expect(MODULES["financial.overview"]).toEqual(["view"]);
  });
});
