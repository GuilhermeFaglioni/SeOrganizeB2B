import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireClosedBetaAdmin: vi.fn(),
  closedBetaAdminErrorResponse: vi.fn((gate: { reason: "unauthorized" | "forbidden" }) =>
    new Response(null, { status: gate.reason === "unauthorized" ? 401 : 403 })),
  listCheckinEditions: vi.fn(),
  createCheckinEdition: vi.fn(),
  getCheckinEdition: vi.fn(),
  updateCheckinEdition: vi.fn(),
  publishCheckinEdition: vi.fn(),
  closeCheckinEdition: vi.fn(),
  duplicateCheckinEdition: vi.fn(),
  listCheckinEditionResponses: vi.fn(),
  grantCheckinExemption: vi.fn(),
  revokeCheckinExemption: vi.fn(),
  resetCheckinResponse: vi.fn(),
  getWorkspaceCheckin: vi.fn(),
  submitCheckinResponse: vi.fn(),
  profileFindUnique: vi.fn(),
  editionFindUnique: vi.fn(),
  responseFindFirst: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/closed-beta/admin", () => ({
  requireClosedBetaAdmin: mocks.requireClosedBetaAdmin,
  closedBetaAdminErrorResponse: mocks.closedBetaAdminErrorResponse,
}));

vi.mock("@/lib/closed-beta/checkin", () => {
  class CheckinValidationError extends Error {}
  class CheckinNotFoundError extends Error {}
  class CheckinConflictError extends Error {}
  class CheckinEditionClosedError extends Error {}
  return {
    CheckinValidationError,
    CheckinNotFoundError,
    CheckinConflictError,
    CheckinEditionClosedError,
    listCheckinEditions: mocks.listCheckinEditions,
    createCheckinEdition: mocks.createCheckinEdition,
    getCheckinEdition: mocks.getCheckinEdition,
    updateCheckinEdition: mocks.updateCheckinEdition,
    publishCheckinEdition: mocks.publishCheckinEdition,
    closeCheckinEdition: mocks.closeCheckinEdition,
    duplicateCheckinEdition: mocks.duplicateCheckinEdition,
    getWorkspaceCheckin: mocks.getWorkspaceCheckin,
    submitCheckinResponse: mocks.submitCheckinResponse,
  };
});

vi.mock("@/lib/closed-beta/responses", () => ({
  listCheckinEditionResponses: mocks.listCheckinEditionResponses,
  getCheckinEditionMetrics: vi.fn(),
  groupCheckinResponsesByQuestion: vi.fn(),
  exportCheckinResponses: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findUnique: mocks.profileFindUnique },
    closedBetaCheckinEdition: { findUnique: mocks.editionFindUnique },
    closedBetaCheckinResponse: { findFirst: mocks.responseFindFirst },
  },
}));

import {
  GET as listCheckins,
  POST as createCheckin,
} from "../app/api/admin/closed-beta/checkins/route";
import {
  GET as getCheckin,
  PATCH as updateCheckin,
} from "../app/api/admin/closed-beta/checkins/[id]/route";
import { POST as publishCheckin } from "../app/api/admin/closed-beta/checkins/[id]/publish/route";
import { POST as closeCheckin } from "../app/api/admin/closed-beta/checkins/[id]/close/route";
import { GET as memberCheckinGET } from "../app/api/closed-beta/checkin/route";

function forbidden() {
  mocks.requireClosedBetaAdmin.mockResolvedValue({
    ok: false,
    reason: "forbidden",
  });
}

function superAdmin() {
  mocks.requireClosedBetaAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@co" },
  });
}

function req(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

function fakeParams(id = "ed-1") {
  return { params: Promise.resolve({ id }) } as never;
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
});

describe("admin check-in 403 on every route", () => {
  beforeEach(() => { forbidden(); });

  it("list", async () => {
    expect((await listCheckins()).status).toBe(403);
  });

  it("create", async () => {
    expect(
      (await createCheckin(req("http://x/api/admin/closed-beta/checkins", "POST", { title: "X", questions: [] }))).status,
    ).toBe(403);
  });

  it("getOne", async () => {
    expect((await getCheckin(req("http://x/x", "GET"), fakeParams())).status).toBe(403);
  });

  it("update", async () => {
    expect(
      (await updateCheckin(req("http://x/x", "PATCH", { title: "Y" }), fakeParams())).status,
    ).toBe(403);
  });

  it("publish", async () => {
    expect(
      (await publishCheckin(req("http://x/x", "POST", {}), fakeParams())).status,
    ).toBe(403);
  });

  it("close", async () => {
    expect(
      (await closeCheckin(req("http://x/x", "POST"), fakeParams())).status,
    ).toBe(403);
  });
});

describe("admin check-in success path", () => {
  beforeEach(() => {
    superAdmin();
    mocks.listCheckinEditions.mockResolvedValue([]);
    mocks.createCheckinEdition.mockResolvedValue({ id: "new-ed", questions: [] });
    mocks.getCheckinEdition.mockResolvedValue({ id: "ed-1", status: "draft", questions: [] });
    mocks.publishCheckinEdition.mockResolvedValue({ id: "ed-1", status: "published" });
    mocks.closeCheckinEdition.mockResolvedValue({ id: "ed-1", status: "closed" });
  });

  it("list succeeds for super-admin", async () => {
    const res = await listCheckins();
    expect(res.status).toBe(200);
  });

  it("create succeeds for super-admin", async () => {
    const res = await createCheckin(
      req("http://x/api/admin/closed-beta/checkins", "POST", { title: "Week 1", questions: [{ text: "Q1", type: "rating" }] }),
    );
    expect(res.status).toBe(201);
  });

  it("getOne succeeds for super-admin", async () => {
    const res = await getCheckin(req("http://x/x", "GET"), fakeParams());
    expect(res.status).toBe(200);
  });

  it("publish succeeds for super-admin", async () => {
    const res = await publishCheckin(req("http://x/x", "POST", {}), fakeParams());
    expect(res.status).toBe(200);
  });

  it("close succeeds for super-admin", async () => {
    const res = await closeCheckin(req("http://x/x", "POST"), fakeParams());
    expect(res.status).toBe(200);
  });
});

describe("member check-in cross-tenant isolation", () => {
  it("uses profile.tenantId as workspaceId, not request body", async () => {
    mocks.getUser.mockResolvedValue({ id: "user-a", email: "a@co" });
    mocks.profileFindUnique.mockResolvedValue({
      tenantId: "workspace-B",
      removedAt: null,
      email: "a@co",
    });
    mocks.getWorkspaceCheckin.mockResolvedValue({
      editionId: "ed-1",
      phase: "open",
      workspaceStatus: "not_applicable",
      blocked: false,
    });
    mocks.editionFindUnique.mockResolvedValue(null);
    mocks.responseFindFirst.mockResolvedValue(null);

    const res = await memberCheckinGET();
    const body = await res.json();

    // Proves the route passes profile.tenantId to getWorkspaceCheckin
    expect(mocks.getWorkspaceCheckin).toHaveBeenCalledWith("workspace-B");
    expect(body.data.workspaceStatus).toBe("not_applicable");
    expect(body.data.blocked).toBe(false);
  });
});
