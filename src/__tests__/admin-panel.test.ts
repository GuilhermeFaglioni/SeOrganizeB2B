import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  isSuperAdmin,
  parseSuperAdminEmails,
} from "../lib/admin/super-admin";

const layoutSource = readFileSync(
  new URL("../app/admin/layout.tsx", import.meta.url),
  "utf8"
);

const sidebarSource = readFileSync(
  new URL("../components/layout/admin-sidebar.tsx", import.meta.url),
  "utf8"
);

afterEach(() => {
  delete process.env.SUPER_ADMIN_EMAIL;
  delete process.env.SUPER_ADMIN_EMAILS;
});

describe("parseSuperAdminEmails", () => {
  it("splits comma-separated emails and trims whitespace", () => {
    expect(
      parseSuperAdminEmails(" a@example.com , b@example.com ,  c@example.com ")
    ).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
  });

  it("normalizes to lowercase", () => {
    expect(parseSuperAdminEmails("Admin@Example.com")).toEqual([
      "admin@example.com",
    ]);
  });

  it("returns an empty array for missing or blank values", () => {
    expect(parseSuperAdminEmails(undefined)).toEqual([]);
    expect(parseSuperAdminEmails("")).toEqual([]);
    expect(parseSuperAdminEmails("  , , ")).toEqual([]);
  });
});

describe("isSuperAdmin email matching", () => {
  it("returns false when no env var is configured", () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(isSuperAdmin({ email: "admin@example.com" })).toBe(false);
  });

  it("matches a single configured email (case-insensitive)", () => {
    process.env.SUPER_ADMIN_EMAIL = "Admin@Example.com";
    expect(isSuperAdmin({ email: "admin@example.com" })).toBe(true);
    expect(isSuperAdmin({ email: "other@example.com" })).toBe(false);
  });

  it("matches any email in a comma-separated list", () => {
    process.env.SUPER_ADMIN_EMAIL = "a@example.com, b@example.com";
    expect(isSuperAdmin({ email: "a@example.com" })).toBe(true);
    expect(isSuperAdmin({ email: "b@example.com" })).toBe(true);
    expect(isSuperAdmin({ email: "c@example.com" })).toBe(false);
  });

  it("supports the SUPER_ADMIN_EMAILS alias", () => {
    process.env.SUPER_ADMIN_EMAILS = "admin@example.com";
    expect(isSuperAdmin({ email: "admin@example.com" })).toBe(true);
  });

  it("returns false for profiles without an email", () => {
    process.env.SUPER_ADMIN_EMAIL = "admin@example.com";
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
    expect(isSuperAdmin({ email: "" })).toBe(false);
  });
});

describe("admin layout gating", () => {
  it("redirects unauthenticated users to /login", () => {
    expect(layoutSource).toContain("getUser()");
    expect(layoutSource).toContain('redirect("/login")');
  });

  it("blocks non-super-admins with a 403 access-denied view", () => {
    expect(layoutSource).toContain("getSuperAdminStatus");
    expect(layoutSource).toContain("<AdminAccessDenied />");
  });

  it("renders the admin sidebar around children for super-admins", () => {
    expect(layoutSource).toContain("<AdminSidebar />");
    expect(layoutSource).toContain("{children}");
  });
});

describe("admin sidebar navigation", () => {
  it("links to the four required admin sections", () => {
    for (const href of [
      "/admin/tenants",
      "/admin/plans",
      "/admin/billing",
      "/admin/support",
    ]) {
      expect(sidebarSource).toContain(`href: "${href}"`);
    }
  });

  it("links to the admin dashboard", () => {
    expect(sidebarSource).toContain('href: "/admin"');
  });

  it("uses the admin sidebar translations", () => {
    expect(sidebarSource).toContain('useTranslations("admin.sidebar")');
  });
});
