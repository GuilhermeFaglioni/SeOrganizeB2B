import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireClosedBetaAdmin: vi.fn(),
  listQuestionBankItems: vi.fn(),
  createQuestionBankItem: vi.fn(),
  updateQuestionBankItem: vi.fn(),
  setQuestionBankItemStatus: vi.fn(),
}));

vi.mock("@/lib/closed-beta/admin", () => ({
  requireClosedBetaAdmin: mocks.requireClosedBetaAdmin,
}));

vi.mock("@/lib/closed-beta/question-bank", () => {
  class QuestionBankValidationError extends Error {}
  class QuestionBankNotFoundError extends Error {}
  return {
    QuestionBankValidationError,
    QuestionBankNotFoundError,
    listQuestionBankItems: mocks.listQuestionBankItems,
    createQuestionBankItem: mocks.createQuestionBankItem,
    updateQuestionBankItem: mocks.updateQuestionBankItem,
    setQuestionBankItemStatus: mocks.setQuestionBankItemStatus,
  };
});

import { GET as list, POST as create } from "../app/api/admin/closed-beta/questions/route";
import {
  PATCH as update,
  POST as setStatus,
} from "../app/api/admin/closed-beta/questions/[id]/route";

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

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "bank-1",
  text: "Como avalia o valor?",
  type: "rating",
  options: null,
  required: true,
  theme: "value",
  isSuggestionQuestion: false,
  status: "active",
  createdAt: "2026-08-18T09:00:00Z",
  updatedAt: "2026-08-18T09:00:00Z",
  ...overrides,
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  admin();
});

describe("admin question bank API", () => {
  it("requires authentication", async () => {
    mocks.requireClosedBetaAdmin.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await list(request("http://x", "GET"))).status).toBe(401);
    expect(
      (await create(request("http://x", "POST", { text: "X", type: "rating" }))).status,
    ).toBe(401);
  });

  it("blocks non-super-admins", async () => {
    mocks.requireClosedBetaAdmin.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect((await list(request("http://x", "GET"))).status).toBe(403);
  });

  it("lists the question bank", async () => {
    mocks.listQuestionBankItems.mockResolvedValue([itemRow()]);
    const res = await list(request("http://x", "GET"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("creates a question bank item", async () => {
    mocks.createQuestionBankItem.mockResolvedValue(itemRow());
    const res = await create(
      request("http://x/api/admin/closed-beta/questions", "POST", {
        text: "Como avalia o valor?",
        type: "rating",
        theme: "value",
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.theme).toBe("value");
    expect(mocks.createQuestionBankItem).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Como avalia o valor?" }),
      expect.objectContaining({ userId: "admin-1" }),
    );
  });

  it("rejects creation without a text", async () => {
    const res = await create(request("http://x/x", "POST", { type: "rating" }));
    expect(res.status).toBe(400);
    expect(mocks.createQuestionBankItem).not.toHaveBeenCalled();
  });

  it("updates a question bank item", async () => {
    mocks.updateQuestionBankItem.mockResolvedValue(itemRow({ text: "Novo" }));
    const res = await update(
      request("http://x/x", "PATCH", { text: "Novo" }),
      { params: { id: "bank-1" } } as never,
    );
    expect(res.status).toBe(200);
    expect(mocks.updateQuestionBankItem).toHaveBeenCalledWith(
      "bank-1",
      expect.objectContaining({ text: "Novo" }),
      expect.anything(),
    );
  });

  it("archives a question bank item", async () => {
    mocks.setQuestionBankItemStatus.mockResolvedValue(itemRow({ status: "archived" }));
    const res = await setStatus(
      request("http://x/x", "POST", { status: "archived" }),
      { params: { id: "bank-1" } } as never,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("archived");
  });

  it("rejects an invalid status", async () => {
    const res = await setStatus(
      request("http://x/x", "POST", { status: "nope" }),
      { params: { id: "bank-1" } } as never,
    );
    expect(res.status).toBe(400);
  });
});
