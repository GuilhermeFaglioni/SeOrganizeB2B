import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { AI_DIRECTIVE_MAX_LENGTH } from "../lib/constants";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  denyFor: vi.fn(),
  getTenantContext: vi.fn(),
  getWorkspaceDirective: vi.fn(),
  upsertWorkspaceDirective: vi.fn(),
  clearWorkspaceDirective: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.denyFor,
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.getTenantContext,
}));

vi.mock("@/lib/ai/directives-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/directives-service")>();
  return {
    ...original,
    get getWorkspaceDirective() {
      return mocks.getWorkspaceDirective;
    },
    get upsertWorkspaceDirective() {
      return mocks.upsertWorkspaceDirective;
    },
    get clearWorkspaceDirective() {
      return mocks.clearWorkspaceDirective;
    },
  };
});

import { DELETE, GET, PUT } from "../app/api/settings/ai/directive/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "PUT" : "GET"),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const directive = {
  id: "directive-1",
  tenantId: "tenant-1",
  content: "Keep the brand tone.",
  updatedBy: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const forbidden = () =>
  NextResponse.json(
    { data: null, error: { code: "FORBIDDEN", message: "forbidden" } },
    { status: 403 },
  );

describe("AI directive API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    mocks.denyFor.mockResolvedValue(null);
    mocks.getTenantContext.mockResolvedValue({
      tenantId: "tenant-1",
      workspaceStatus: "active",
      gracePeriodEndsAt: null,
      cancelledAt: null,
      isAdmin: true,
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks ai.manageDirectives", async () => {
    mocks.denyFor.mockResolvedValue(forbidden());

    const res = await GET();
    expect(res.status).toBe(403);
    expect(mocks.getWorkspaceDirective).not.toHaveBeenCalled();
  });

  it("reads the directive scoped to the caller's tenant", async () => {
    mocks.getWorkspaceDirective.mockResolvedValue(directive);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(mocks.getWorkspaceDirective).toHaveBeenCalledWith("tenant-1");
    const json = await res.json();
    expect(json.data).toEqual(directive);
  });

  it("returns data null when the workspace has no directive", async () => {
    mocks.getWorkspaceDirective.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toBeNull();
  });

  it("denies writes when the caller lacks ai.manageDirectives", async () => {
    mocks.denyFor.mockResolvedValue(forbidden());

    const res = await PUT(makeRequest("http://x/api/settings/ai/directive", { content: "x" }));
    expect(res.status).toBe(403);
    expect(mocks.upsertWorkspaceDirective).not.toHaveBeenCalled();
  });

  it("rejects a non-text payload with 400", async () => {
    const res = await PUT(makeRequest("http://x/api/settings/ai/directive", { content: 42 }));

    expect(res.status).toBe(400);
    expect(mocks.upsertWorkspaceDirective).not.toHaveBeenCalled();
  });

  it("rejects an oversized payload with 400 without truncating", async () => {
    const res = await PUT(
      makeRequest("http://x/api/settings/ai/directive", {
        content: "a".repeat(AI_DIRECTIVE_MAX_LENGTH + 1),
      }),
    );

    expect(res.status).toBe(400);
    expect(mocks.upsertWorkspaceDirective).not.toHaveBeenCalled();
  });

  it("saves a trimmed directive for the caller's tenant", async () => {
    mocks.upsertWorkspaceDirective.mockResolvedValue(directive);

    const res = await PUT(
      makeRequest("http://x/api/settings/ai/directive", { content: "  brand tone  " }),
    );

    expect(res.status).toBe(200);
    expect(mocks.upsertWorkspaceDirective).toHaveBeenCalledWith(
      { content: "brand tone" },
      "tenant-1",
      "user-1",
    );
    const json = await res.json();
    expect(json.data).toEqual(directive);
  });

  it("clears the directive for the caller's tenant", async () => {
    mocks.clearWorkspaceDirective.mockResolvedValue(undefined);

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mocks.clearWorkspaceDirective).toHaveBeenCalledWith("tenant-1");
  });

  it("denies clearing when the caller lacks ai.manageDirectives", async () => {
    mocks.denyFor.mockResolvedValue(forbidden());

    const res = await DELETE();

    expect(res.status).toBe(403);
    expect(mocks.clearWorkspaceDirective).not.toHaveBeenCalled();
  });
});
