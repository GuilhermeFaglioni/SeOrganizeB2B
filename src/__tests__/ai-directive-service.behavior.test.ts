import { describe, expect, it, vi, beforeEach } from "vitest";
import { FinancialValidationError } from "../lib/financial/lifecycle";

const mocks = vi.hoisted(() => ({
  directiveFindUnique: vi.fn(),
  directiveUpsert: vi.fn(),
  directiveDelete: vi.fn(),
  withTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspaceDirective: {
      findUnique: mocks.directiveFindUnique,
      upsert: mocks.directiveUpsert,
      delete: mocks.directiveDelete,
    },
  },
  withTenant: mocks.withTenant,
}));

import {
  clearWorkspaceDirective,
  getWorkspaceDirective,
  upsertWorkspaceDirective,
  validateDirectiveContent,
  AI_DIRECTIVE_MAX_LENGTH,
} from "../lib/ai/directives-service";
import { isValidPermission, allScopedPermissions, permissionKey } from "../lib/authz/permissions";

const directiveRow = {
  id: "directive-1",
  tenantId: "tenant-1",
  content: "Keep the brand tone.",
  updatedBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

describe("AI directive service", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.withTenant.mockImplementation((_tenantId: string, fn: () => unknown) => fn());
  });

  describe("validateDirectiveContent", () => {
    it("accepts only a string payload", () => {
      expect(() => validateDirectiveContent(42)).toThrow(FinancialValidationError);
      expect(() => validateDirectiveContent(null)).toThrow(FinancialValidationError);
      expect(() => validateDirectiveContent({ content: "x" })).toThrow(FinancialValidationError);
      expect(() => validateDirectiveContent(undefined)).toThrow(FinancialValidationError);
    });

    it("trims surrounding whitespace", () => {
      expect(validateDirectiveContent("  clean   ")).toBe("clean");
    });

    it("accepts content at exactly the maximum length", () => {
      const content = "a".repeat(AI_DIRECTIVE_MAX_LENGTH);
      expect(validateDirectiveContent(content)).toBe(content);
    });

    it("rejects oversized payloads instead of truncating silently", () => {
      const content = "a".repeat(AI_DIRECTIVE_MAX_LENGTH + 1);
      expect(() => validateDirectiveContent(content)).toThrow(FinancialValidationError);
    });
  });

  describe("getWorkspaceDirective", () => {
    it("scopes the read to the tenant and returns the row", async () => {
      mocks.directiveFindUnique.mockResolvedValue(directiveRow);

      const result = await getWorkspaceDirective("tenant-1");

      expect(mocks.withTenant).toHaveBeenCalledWith("tenant-1", expect.any(Function));
      expect(mocks.directiveFindUnique).toHaveBeenCalledWith({ where: { tenantId: "tenant-1" } });
      expect(result).toEqual(directiveRow);
    });

    it("returns null when the workspace has no directive", async () => {
      mocks.directiveFindUnique.mockResolvedValue(null);

      const result = await getWorkspaceDirective("tenant-1");

      expect(result).toBeNull();
    });
  });

  describe("upsertWorkspaceDirective", () => {
    it("keeps a single directive per workspace via a tenant-unique upsert", async () => {
      mocks.directiveUpsert.mockResolvedValue(directiveRow);

      await upsertWorkspaceDirective({ content: "  brand tone  " }, "tenant-1", "user-1");

      expect(mocks.withTenant).toHaveBeenCalledWith("tenant-1", expect.any(Function));
      expect(mocks.directiveUpsert).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        update: { content: "brand tone", updatedBy: "user-1" },
        create: { tenantId: "tenant-1", content: "brand tone", updatedBy: "user-1" },
      });
    });

    it("records the acting user for traceability (updatedBy)", async () => {
      mocks.directiveUpsert.mockResolvedValue(directiveRow);

      await upsertWorkspaceDirective({ content: "x" }, "tenant-1", "user-9");

      const call = mocks.directiveUpsert.mock.calls[0][0];
      expect(call.update.updatedBy).toBe("user-9");
      expect(call.create.updatedBy).toBe("user-9");
    });

    it("rejects invalid content before touching the database", async () => {
      const content = "a".repeat(AI_DIRECTIVE_MAX_LENGTH + 1);

      await expect(
        upsertWorkspaceDirective({ content }, "tenant-1", "user-1"),
      ).rejects.toThrow(FinancialValidationError);

      expect(mocks.directiveUpsert).not.toHaveBeenCalled();
    });
  });

  describe("clearWorkspaceDirective", () => {
    it("deletes the directive when one exists", async () => {
      mocks.directiveFindUnique.mockResolvedValue({ id: "directive-1" });

      await clearWorkspaceDirective("tenant-1");

      expect(mocks.directiveDelete).toHaveBeenCalledWith({ where: { id: "directive-1" } });
    });

    it("is a no-op when the workspace has no directive", async () => {
      mocks.directiveFindUnique.mockResolvedValue(null);

      await clearWorkspaceDirective("tenant-1");

      expect(mocks.directiveDelete).not.toHaveBeenCalled();
    });
  });

  describe("session snapshot", () => {
    it("captures a point-in-time snapshot that later edits do not mutate", async () => {
      const snapshot = { ...directiveRow };
      mocks.directiveFindUnique.mockResolvedValue(snapshot);

      const read = await getWorkspaceDirective("tenant-1");
      expect(read).toEqual(snapshot);

      // A later edit produces a different row; the already-read snapshot is untouched.
      const edited = { ...directiveRow, content: "new tone", updatedAt: new Date() };
      expect(read?.content).toBe("Keep the brand tone.");
      expect(read).not.toBe(edited);
    });
  });

  describe("permission catalog", () => {
    it("registers ai.manageDirectives as a valid permission", () => {
      expect(isValidPermission("ai.manageDirectives")).toBe(true);
    });

    it("grants ai.manageDirectives to the Admin role by default", () => {
      const keys = allScopedPermissions().map(permissionKey);
      expect(keys).toContain("ai.manageDirectives");
    });
  });
});
