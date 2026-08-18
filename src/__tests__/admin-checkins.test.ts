import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireClosedBetaAdmin: vi.fn(),
  listCheckinEditions: vi.fn(),
  createCheckinEdition: vi.fn(),
  getCheckinEdition: vi.fn(),
  updateCheckinEdition: vi.fn(),
  publishCheckinEdition: vi.fn(),
  closeCheckinEdition: vi.fn(),
}));

vi.mock("@/lib/closed-beta/admin", () => ({
  requireClosedBetaAdmin: mocks.requireClosedBetaAdmin,
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
  };
});

import { CheckinConflictError } from "@/lib/closed-beta/checkin";
import { GET as list, POST as create } from "../app/api/admin/closed-beta/checkins/route";
import {
  GET as getOne,
  PATCH as update,
} from "../app/api/admin/closed-beta/checkins/[id]/route";
import { POST as publish } from "../app/api/admin/closed-beta/checkins/[id]/publish/route";
import { POST as close } from "../app/api/admin/closed-beta/checkins/[id]/close/route";

function admin() {
  mocks.requireClosedBetaAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@example.com" },
  });
}

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const editionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "edition-1",
  title: "Check-in Semana 1",
  status: "draft",
  isMandatory: true,
  opensAt: null,
  closesAt: null,
  createdAt: "2026-08-18T09:00:00Z",
  updatedAt: "2026-08-18T09:00:00Z",
  questions: [],
  ...overrides,
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  admin();
});

describe("admin check-in editions API", () => {
  it("requires authentication on every operation", async () => {
    mocks.requireClosedBetaAdmin.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    });

    expect((await list()).status).toBe(401);
    expect(
      (
        await create(
          request("http://x/api/admin/closed-beta/checkins", "POST", {
            title: "X",
            questions: [],
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (await getOne(request("http://x/x", "GET"), { params: { id: "1" } } as never)).status,
    ).toBe(401);
    expect(
      (
        await update(request("http://x/x", "PATCH", { title: "Y" }), {
          params: { id: "1" },
        } as never)
      ).status,
    ).toBe(401);
    expect(
      (
        await publish(request("http://x/x", "POST", {}), {
          params: { id: "1" },
        } as never)
      ).status,
    ).toBe(401);
    expect(
      (await close(request("http://x/x", "POST"), { params: { id: "1" } } as never))
        .status,
    ).toBe(401);
  });

  it("blocks non-super-admins", async () => {
    mocks.requireClosedBetaAdmin.mockResolvedValue({ ok: false, reason: "forbidden" });

    expect((await list()).status).toBe(403);
    expect(
      (await create(request("http://x/x", "POST", { title: "X", questions: [] }))).status,
    ).toBe(403);
  });

  it("lists editions for a super-admin", async () => {
    mocks.listCheckinEditions.mockResolvedValue([editionRow()]);

    const res = await list();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("creates a draft edition with questions", async () => {
    mocks.createCheckinEdition.mockResolvedValue(
      editionRow({ questions: [{ id: "q1", text: "Pergunta" }] }),
    );

    const res = await create(
      request("http://x/api/admin/closed-beta/checkins", "POST", {
        title: "Check-in Semana 1",
        questions: [
          { text: "Pergunta", type: "rating", isSuggestionQuestion: false },
        ],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.questions).toHaveLength(1);
    expect(mocks.createCheckinEdition).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Check-in Semana 1" }),
      expect.objectContaining({ userId: "admin-1" }),
    );
  });

  it("rejects creation without a title", async () => {
    const res = await create(
      request("http://x/x", "POST", { questions: [] }),
    );
    expect(res.status).toBe(400);
    expect(mocks.createCheckinEdition).not.toHaveBeenCalled();
  });

  it("rejects creation with a non-array questions field", async () => {
    const res = await create(
      request("http://x/x", "POST", { title: "X", questions: "nope" }),
    );
    expect(res.status).toBe(400);
  });

  it("updates a draft edition", async () => {
    mocks.updateCheckinEdition.mockResolvedValue(
      editionRow({ title: "Renomeado" }),
    );

    const res = await update(
      request("http://x/api/admin/closed-beta/checkins/edition-1", "PATCH", {
        title: "Renomeado",
      }),
      { params: { id: "edition-1" } } as never,
    );

    expect(res.status).toBe(200);
    expect(mocks.updateCheckinEdition).toHaveBeenCalledWith(
      "edition-1",
      expect.objectContaining({ title: "Renomeado" }),
      expect.anything(),
    );
  });

  it("rejects invalid PATCH body shapes", async () => {
    const res = await update(
      request("http://x/x", "PATCH", { title: 42 }),
      { params: { id: "1" } } as never,
    );
    expect(res.status).toBe(400);
  });

  it("publishes a draft edition with an open and close window", async () => {
    mocks.publishCheckinEdition.mockResolvedValue(
      editionRow({ status: "published" }),
    );

    const res = await publish(
      request("http://x/x", "POST", {
        opensAt: "2026-08-19T00:00:00.000Z",
        closesAt: "2026-08-25T00:00:00.000Z",
      }),
      { params: { id: "edition-1" } } as never,
    );

    expect(res.status).toBe(200);
    expect(mocks.publishCheckinEdition).toHaveBeenCalledWith(
      "edition-1",
      expect.objectContaining({
        opensAt: new Date("2026-08-19T00:00:00.000Z"),
        closesAt: new Date("2026-08-25T00:00:00.000Z"),
      }),
      expect.anything(),
    );
  });

  it("rejects an invalid publication date", async () => {
    const res = await publish(
      request("http://x/x", "POST", { opensAt: "not-a-date" }),
      { params: { id: "1" } } as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when another mandatory edition is already published", async () => {
    mocks.publishCheckinEdition.mockRejectedValue(
      new CheckinConflictError("Another mandatory check-in edition is already published"),
    );

    const res = await publish(request("http://x/x", "POST", {}), {
      params: { id: "edition-1" },
    } as never);

    expect(res.status).toBe(409);
  });

  it("closes a published edition", async () => {
    mocks.closeCheckinEdition.mockResolvedValue(
      editionRow({ status: "closed" }),
    );

    const res = await close(request("http://x/x", "POST"), {
      params: { id: "edition-1" },
    } as never);

    expect(res.status).toBe(200);
  });
});
