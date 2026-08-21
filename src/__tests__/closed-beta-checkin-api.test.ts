import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getWorkspaceCheckin: vi.fn(),
  submitCheckinResponse: vi.fn(),
  profileFindUnique: vi.fn(),
  editionFindUnique: vi.fn(),
  responseFindFirst: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));

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
    getWorkspaceCheckin: mocks.getWorkspaceCheckin,
    submitCheckinResponse: mocks.submitCheckinResponse,
  };
});

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findUnique: mocks.profileFindUnique },
    closedBetaCheckinEdition: { findUnique: mocks.editionFindUnique },
    closedBetaCheckinResponse: { findFirst: mocks.responseFindFirst },
  },
}));

import { CheckinValidationError } from "@/lib/closed-beta/checkin";
import { GET, POST } from "../app/api/closed-beta/checkin/route";

const edition = {
  id: "edition-1",
  title: "Check-in Semana 1",
  status: "published",
  opensAt: "2026-08-10T00:00:00Z",
  closesAt: "2026-08-25T00:00:00Z",
  questions: [
    {
      id: "q1",
      text: "Como avalia o valor?",
      type: "rating",
      options: null,
      required: true,
      position: 1,
      isSuggestionQuestion: false,
    },
  ],
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
  mocks.profileFindUnique.mockResolvedValue({
    tenantId: "workspace-1",
    removedAt: null,
    email: "a@b.c",
  });
});

describe("beta check-in API", () => {
  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    const res = await POST(
      new NextRequest("http://x", {
        method: "POST",
        body: JSON.stringify({ editionId: "e1", answers: {} }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects members that no longer belong to a workspace", async () => {
    mocks.profileFindUnique.mockResolvedValue({ removedAt: new Date() });
    expect((await GET()).status).toBe(403);
  });

  it("reports the blocked status and edition for the member", async () => {
    mocks.getWorkspaceCheckin.mockResolvedValue({
      editionId: "edition-1",
      phase: "overdue",
      workspaceStatus: "pending",
      blocked: true,
    });
    mocks.editionFindUnique.mockResolvedValue(edition);
    mocks.responseFindFirst.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.blocked).toBe(true);
    expect(body.data.edition.id).toBe("edition-1");
    expect(body.data.memberSubmitted).toBe(false);
    expect(body.data.edition.questions).toHaveLength(1);
  });

  it("marks the member as already submitted when they answered", async () => {
    mocks.getWorkspaceCheckin.mockResolvedValue({
      editionId: "edition-1",
      phase: "open",
      workspaceStatus: "completed",
      blocked: false,
    });
    mocks.editionFindUnique.mockResolvedValue(edition);
    mocks.responseFindFirst.mockResolvedValue({ id: "response-1" });

    const body = await (await GET()).json();
    expect(body.data.memberSubmitted).toBe(true);
  });

  it("returns not applicable when there is no active edition", async () => {
    mocks.getWorkspaceCheckin.mockResolvedValue({
      editionId: null,
      phase: null,
      workspaceStatus: "not_applicable",
      blocked: false,
    });

    const body = await (await GET()).json();
    expect(body.data.workspaceStatus).toBe("not_applicable");
    expect(body.data.edition).toBeNull();
  });

  it("submits the response and returns the resulting workspace status", async () => {
    mocks.submitCheckinResponse.mockResolvedValue({
      completedWorkspace: true,
      workspaceStatus: "completed",
      duplicate: false,
    });

    const res = await POST(
      new NextRequest("http://x", {
        method: "POST",
        body: JSON.stringify({ editionId: "edition-1", answers: { q1: 5 } }),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.completedWorkspace).toBe(true);
    expect(mocks.submitCheckinResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        profileId: "user-1",
        answers: { q1: 5 },
      }),
    );
  });

  it("accepts a did-not-use submission", async () => {
    mocks.submitCheckinResponse.mockResolvedValue({
      completedWorkspace: true,
      workspaceStatus: "completed",
      duplicate: false,
    });

    const res = await POST(
      new NextRequest("http://x", {
        method: "POST",
        body: JSON.stringify({ editionId: "edition-1", didNotUse: true }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.submitCheckinResponse).toHaveBeenCalledWith(
      expect.objectContaining({ didNotUse: true, answers: {} }),
    );
  });

  it("rejects an invalid editionId", async () => {
    const res = await POST(
      new NextRequest("http://x", {
        method: "POST",
        body: JSON.stringify({ answers: {} }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.submitCheckinResponse).not.toHaveBeenCalled();
  });

  it("maps domain validation errors to 400", async () => {
    mocks.submitCheckinResponse.mockRejectedValue(
      new CheckinValidationError("Some required questions were not answered"),
    );

    const res = await POST(
      new NextRequest("http://x", {
        method: "POST",
        body: JSON.stringify({ editionId: "edition-1", answers: {} }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
