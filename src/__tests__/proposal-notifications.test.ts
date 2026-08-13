import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";

const { mockTx, mockRecordActivity, mockSendPushToUser, mockBuildPushPayload } = vi.hoisted(() => {
  const mockTx = {
    proposal: { findUnique: vi.fn() },
  };
  return {
    mockTx: mockTx,
    mockRecordActivity: vi.fn(),
    mockSendPushToUser: vi.fn(),
    mockBuildPushPayload: vi.fn(),
  };
});

vi.mock("../../prisma/client", () => ({
  prisma: {},
  requireTenantId: () => "tenant-1",
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
}));

vi.mock("../lib/activity/record", () => ({
  recordActivity: mockRecordActivity,
}));

vi.mock("../lib/push", () => ({
  sendPushToUser: mockSendPushToUser,
  buildPushPayload: mockBuildPushPayload,
}));

import { notifyProposalEvent } from "../lib/financial/proposal-notifications";

describe("notifyProposalEvent", () => {
  beforeEach(() => {
    mockTx.proposal.findUnique.mockReset();
    mockRecordActivity.mockReset();
    mockSendPushToUser.mockReset();
    mockBuildPushPayload.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing if proposal is not found", async () => {
    mockTx.proposal.findUnique.mockResolvedValue(null);

    await notifyProposalEvent({
      tx: mockTx as unknown as Prisma.TransactionClient,
      proposalId: "nonexistent",
      eventType: "proposal.viewed",
    });

    expect(mockRecordActivity).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("records activity and sends push for proposal.viewed", async () => {
    mockTx.proposal.findUnique.mockResolvedValue({
      id: "p-1",
      code: "PRP-2026-0001",
      title: "Consultoria",
      createdBy: "user-1",
      tenantId: "tenant-1",
    });
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-1"] });
    mockBuildPushPayload.mockReturnValue({ title: "Proposta visualizada", body: "..." });

    await notifyProposalEvent({
      tx: mockTx as unknown as Prisma.TransactionClient,
      proposalId: "p-1",
      eventType: "proposal.viewed",
    });

    expect(mockRecordActivity).toHaveBeenCalledWith(mockTx, {
      actorId: null,
      type: "proposal.viewed",
      entityType: "proposal",
      entityId: "p-1",
      summary: "Proposta PRP-2026-0001 foi visualizada pelo cliente",
      notifyProfileIds: ["user-1"],
      tenantId: "tenant-1",
    });
    expect(mockBuildPushPayload).toHaveBeenCalledWith({
      activityType: "proposal.viewed",
      summary: "Proposta PRP-2026-0001 foi visualizada pelo cliente",
      actorName: "Cliente",
      entityType: "proposal",
      entityId: "p-1",
    });
    expect(mockSendPushToUser).toHaveBeenCalledWith("user-1", { title: "Proposta visualizada", body: "..." });
  });

  it("records activity with actor name for proposal.accepted", async () => {
    mockTx.proposal.findUnique.mockResolvedValue({
      id: "p-2",
      code: "PRP-2026-0002",
      title: "Desenvolvimento",
      createdBy: "user-2",
      tenantId: "tenant-1",
    });
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-2"] });
    mockBuildPushPayload.mockReturnValue({ title: "Proposta aceita!", body: "..." });

    await notifyProposalEvent({
      tx: mockTx as unknown as Prisma.TransactionClient,
      proposalId: "p-2",
      eventType: "proposal.accepted",
      actorName: "João Silva",
    });

    expect(mockRecordActivity).toHaveBeenCalledWith(mockTx, {
      actorId: null,
      type: "proposal.accepted",
      entityType: "proposal",
      entityId: "p-2",
      summary: "Proposta PRP-2026-0002 foi aceita por João Silva",
      notifyProfileIds: ["user-2"],
      tenantId: "tenant-1",
    });
  });

  it("records activity for proposal.rejected", async () => {
    mockTx.proposal.findUnique.mockResolvedValue({
      id: "p-3",
      code: "PRP-2026-0003",
      title: "Consultoria",
      createdBy: "user-3",
      tenantId: "tenant-1",
    });
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-3"] });
    mockBuildPushPayload.mockReturnValue(null);

    await notifyProposalEvent({
      tx: mockTx as unknown as Prisma.TransactionClient,
      proposalId: "p-3",
      eventType: "proposal.rejected",
    });

    expect(mockRecordActivity).toHaveBeenCalledWith(mockTx, {
      actorId: null,
      type: "proposal.rejected",
      entityType: "proposal",
      entityId: "p-3",
      summary: "Proposta PRP-2026-0003 foi recusada pelo cliente",
      notifyProfileIds: ["user-3"],
      tenantId: "tenant-1",
    });
    // buildPushPayload returns null, so no push sent
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("does not send push if no recipients", async () => {
    mockTx.proposal.findUnique.mockResolvedValue({
      id: "p-4",
      code: "PRP-2026-0004",
      title: "Consultoria",
      createdBy: "user-4",
      tenantId: "tenant-1",
    });
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: [] });

    await notifyProposalEvent({
      tx: mockTx as unknown as Prisma.TransactionClient,
      proposalId: "p-4",
      eventType: "proposal.viewed",
    });

    expect(mockBuildPushPayload).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});
