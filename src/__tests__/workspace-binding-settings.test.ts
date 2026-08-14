import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  workspaceUpdate: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: {
      findUnique: mocks.workspaceFindUnique,
      update: mocks.workspaceUpdate,
    },
  },
}));

import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "../lib/financial/workspace-settings-service";

describe("workspace binding code settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceUpdate.mockResolvedValue({ id: "workspace-1" });
  });

  it("returns only whether a binding code exists", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "workspace-1",
      companyName: "Acme",
      logoUrl: null,
      pixKey: null,
      bindingCodeHash: "scrypt$secret-hash",
    });

    await expect(getWorkspaceSettings("workspace-1")).resolves.toEqual({
      id: "workspace-1",
      companyName: "Acme",
      logoUrl: null,
      pixKey: null,
      hasBindingCode: true,
    });
  });

  it("hashes and persists a new binding code without writing plaintext", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "workspace-1",
      companyName: null,
      logoUrl: null,
      pixKey: null,
      bindingCodeHash: "scrypt$stored",
    });

    await updateWorkspaceSettings(
      { bindingCode: "Acme-Join-2026" },
      "workspace-1",
    );

    const [updateArgs] = mocks.workspaceUpdate.mock.calls[0];
    expect(updateArgs.data.bindingCodeHash).toMatch(/^scrypt\$/);
    expect(updateArgs.data.bindingCodeHash).not.toContain("Acme-Join-2026");
    expect(updateArgs.data.bindingCodeUpdatedAt).toBeInstanceOf(Date);
  });

  it("rejects a binding code shorter than eight characters", async () => {
    await expect(
      updateWorkspaceSettings({ bindingCode: "short" }, "workspace-1"),
    ).rejects.toThrow("at least 8 characters");
    expect(mocks.workspaceUpdate).not.toHaveBeenCalled();
  });
});
