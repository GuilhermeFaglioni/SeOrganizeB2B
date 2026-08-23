import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  denyFor: vi.fn(),
  getTenantContext: vi.fn(),
  getUser: vi.fn(),
  listConnections: vi.fn(),
  connectApiKey: vi.fn(),
  revokeConnection: vi.fn(),
  validateConnection: vi.fn(),
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

vi.mock("@/lib/ai/connections-service", () => ({
  get listConnections() {
    return mocks.listConnections;
  },
  get connectApiKey() {
    return mocks.connectApiKey;
  },
  get revokeConnection() {
    return mocks.revokeConnection;
  },
  get validateConnection() {
    return mocks.validateConnection;
  },
}));

import { GET as listGET, POST as connectPOST } from "../app/api/ai/connections/route";
import { DELETE as revokeDELETE } from "../app/api/ai/connections/[provider]/route";
import { POST as validatePOST } from "../app/api/ai/connections/[provider]/validate/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const connection = {
  id: "conn-1",
  provider: "openai",
  authMethod: "api_key",
  defaultModel: "gpt-4o",
  status: "active",
  createdBy: "user-1",
  validatedAt: null,
  lastErrorCode: null,
  revokedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AI connections API", () => {
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
    const res = await listGET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller lacks ai.manageConnections", async () => {
    mocks.denyFor.mockResolvedValue(
      NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "forbidden" } },
        { status: 403 },
      ),
    );

    const res = await listGET();
    expect(res.status).toBe(403);
    expect(mocks.listConnections).not.toHaveBeenCalled();
  });

  it("lists connections scoped to the caller's tenant", async () => {
    mocks.listConnections.mockResolvedValue([connection]);

    const res = await listGET();

    expect(res.status).toBe(200);
    expect(mocks.listConnections).toHaveBeenCalledWith("tenant-1");
    const json = await res.json();
    expect(json.data).toEqual([connection]);
  });

  it("connects an OpenAI API key for the caller's tenant", async () => {
    mocks.connectApiKey.mockResolvedValue(connection);

    const res = await connectPOST(
      makeRequest("http://x/api/ai/connections", {
        provider: "openai",
        apiKey: "sk-secret",
      }),
    );

    expect(res.status).toBe(201);
    expect(mocks.connectApiKey).toHaveBeenCalledWith("tenant-1", "user-1", {
      provider: "openai",
      apiKey: "sk-secret",
      defaultModel: undefined,
    });
  });

  it("returns 400 for a malformed request body", async () => {
    const req = new NextRequest("http://x/api/ai/connections", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await connectPOST(req);

    expect(res.status).toBe(400);
    expect(mocks.connectApiKey).not.toHaveBeenCalled();
  });

  it("revokes a connection for the caller's tenant", async () => {
    mocks.revokeConnection.mockResolvedValue({ ...connection, status: "revoked" });

    const res = await revokeDELETE(makeRequest("http://x/api/ai/connections/openai", undefined, "DELETE"), {
      params: Promise.resolve({ provider: "openai" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.revokeConnection).toHaveBeenCalledWith("tenant-1", "openai", "user-1");
  });

  it("rejects an unknown provider on revoke", async () => {
    const res = await revokeDELETE(makeRequest("http://x/api/ai/connections/google", undefined, "DELETE"), {
      params: Promise.resolve({ provider: "google" }),
    });

    expect(res.status).toBe(400);
    expect(mocks.revokeConnection).not.toHaveBeenCalled();
  });

  it("validates a connection for the caller's tenant", async () => {
    mocks.validateConnection.mockResolvedValue(connection);

    const res = await validatePOST(makeRequest("http://x/api/ai/connections/openai/validate", undefined, "POST"), {
      params: Promise.resolve({ provider: "openai" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.validateConnection).toHaveBeenCalledWith("tenant-1", "openai", "user-1");
  });

  it("denies connect when the caller lacks ai.manageConnections", async () => {
    mocks.denyFor.mockResolvedValue(
      NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "forbidden" } },
        { status: 403 },
      ),
    );

    const res = await connectPOST(
      makeRequest("http://x/api/ai/connections", { provider: "openai", apiKey: "sk" }),
    );

    expect(res.status).toBe(403);
    expect(mocks.connectApiKey).not.toHaveBeenCalled();
  });
});
