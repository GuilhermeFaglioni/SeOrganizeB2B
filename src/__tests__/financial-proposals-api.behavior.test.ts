import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "../lib/financial/lifecycle";

const mocks = vi.hoisted(() => ({
  mockCreateProposalDraft: vi.fn(),
  mockSendProposal: vi.fn(),
  mockAcceptProposal: vi.fn(),
  mockRejectProposal: vi.fn(),
  mockCloneProposal: vi.fn(),
  mockDeleteProposal: vi.fn(),
  mockGetProposal: vi.fn(),
  mockListProposals: vi.fn(),
  mockGetProposalPublic: vi.fn(),
  mockCreateProposalTemplate: vi.fn(),
  mockUpdateProposalTemplate: vi.fn(),
  mockDeleteProposalTemplate: vi.fn(),
  mockListProposalTemplates: vi.fn(),
  mockGetProposalTemplate: vi.fn(),
  mockGetWorkspaceSettings: vi.fn(),
  mockUpdateWorkspaceSettings: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({ prisma: {} }));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/financial/proposals-service", () => ({
  get createProposalDraft() {
    return mocks.mockCreateProposalDraft;
  },
  get sendProposal() {
    return mocks.mockSendProposal;
  },
  get acceptProposal() {
    return mocks.mockAcceptProposal;
  },
  get rejectProposal() {
    return mocks.mockRejectProposal;
  },
  get cloneProposal() {
    return mocks.mockCloneProposal;
  },
  get deleteProposal() {
    return mocks.mockDeleteProposal;
  },
  get getProposal() {
    return mocks.mockGetProposal;
  },
  get listProposals() {
    return mocks.mockListProposals;
  },
  get getProposalPublic() {
    return mocks.mockGetProposalPublic;
  },
}));

vi.mock("@/lib/financial/proposal-templates-service", () => ({
  get createProposalTemplate() {
    return mocks.mockCreateProposalTemplate;
  },
  get updateProposalTemplate() {
    return mocks.mockUpdateProposalTemplate;
  },
  get deleteProposalTemplate() {
    return mocks.mockDeleteProposalTemplate;
  },
  get listProposalTemplates() {
    return mocks.mockListProposalTemplates;
  },
  get getProposalTemplate() {
    return mocks.mockGetProposalTemplate;
  },
}));

vi.mock("@/lib/financial/workspace-settings-service", () => ({
  get getWorkspaceSettings() {
    return mocks.mockGetWorkspaceSettings;
  },
  get updateWorkspaceSettings() {
    return mocks.mockUpdateWorkspaceSettings;
  },
}));

import { POST as createProposalPOST } from "../app/api/proposals/route";
import { POST as sendProposalPOST } from "../app/api/proposals/[id]/send/route";
import { POST as publicAcceptPOST } from "../app/api/p/[token]/route";
import { POST as createTemplatePOST } from "../app/api/proposal-templates/route";
import { GET as workspaceGET } from "../app/api/settings/workspace/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const mockProposal = {
  id: "prp-1",
  code: "PRP-2026-0001",
  token: "tok-1",
  title: "Proposta teste",
  status: "draft",
  clientId: "client-1",
};

describe("proposals API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("validates required fields on create", async () => {
    const res = await createProposalPOST(
      makeRequest("http://x/api/proposals", { title: "", clientId: "" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a draft proposal calling the service", async () => {
    mocks.mockCreateProposalDraft.mockResolvedValue(mockProposal);
    const res = await createProposalPOST(
      makeRequest("http://x/api/proposals", {
        title: "Proposta",
        clientId: "client-1",
        items: [],
      })
    );
    expect(res.status).toBe(201);
    expect(mocks.mockCreateProposalDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Proposta", clientId: "client-1" }),
      "user-1"
    );
  });

  it("sends a proposal", async () => {
    mocks.mockSendProposal.mockResolvedValue({ ...mockProposal, status: "sent" });
    const res = await sendProposalPOST(
      makeRequest("http://x/api/proposals/prp-1/send"),
      { params: { id: "prp-1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockSendProposal).toHaveBeenCalledWith("prp-1");
  });

  it("returns 400 for public accept without a name", async () => {
    const res = await publicAcceptPOST(
      makeRequest("http://x/api/p/tok-1", {}),
      { params: { token: "tok-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("accepts a public proposal by token", async () => {
    mocks.mockAcceptProposal.mockResolvedValue({ ...mockProposal, status: "accepted" });
    const res = await publicAcceptPOST(
      makeRequest("http://x/api/p/tok-1", { name: "Cliente" }),
      { params: { token: "tok-1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockAcceptProposal).toHaveBeenCalledWith("tok-1", "Cliente");
  });

  it("maps validation errors to 400 on public accept", async () => {
    mocks.mockAcceptProposal.mockRejectedValue(
      new FinancialValidationError("This proposal is not available")
    );
    const res = await publicAcceptPOST(
      makeRequest("http://x/api/p/tok-1", { name: "Cliente" }),
      { params: { token: "tok-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("maps conflicts to 409 on public accept", async () => {
    mocks.mockAcceptProposal.mockRejectedValue(
      new FinancialConflictError("This proposal has already been accepted")
    );
    const res = await publicAcceptPOST(
      makeRequest("http://x/api/p/tok-1", { name: "Cliente" }),
      { params: { token: "tok-1" } }
    );
    expect(res.status).toBe(409);
  });

  it("sanitizes template HTML before persisting", async () => {
    mocks.mockCreateProposalTemplate.mockResolvedValue({ id: "tpl-1", name: "T" });
    const res = await createTemplatePOST(
      makeRequest("http://x/api/proposal-templates", {
        name: "Template",
        html: "<p>ok</p><script>alert(1)</script>",
      })
    );
    expect(res.status).toBe(201);
    const [input] = mocks.mockCreateProposalTemplate.mock.calls[0];
    expect(input.html).toContain("<p>ok</p>");
    expect(input.html).not.toContain("<script");
  });

  it("reads workspace settings", async () => {
    mocks.mockGetWorkspaceSettings.mockResolvedValue({
      id: "default",
      companyName: "Acme",
    });
    const res = await workspaceGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.companyName).toBe("Acme");
  });
});
