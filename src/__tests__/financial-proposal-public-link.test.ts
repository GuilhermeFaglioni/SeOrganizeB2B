import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const proposalFindFirst = vi.fn();
  const proposalFindUnique = vi.fn();
  const proposalUpdateMany = vi.fn();
  const proposalUpdate = vi.fn();
  const contractFindUnique = vi.fn();
  const contractFindFirst = vi.fn();
  const contractCreate = vi.fn();
  const workspaceFindUnique = vi.fn();

  const tx = {
    proposal: {
      findUnique: proposalFindUnique,
      updateMany: proposalUpdateMany,
      update: proposalUpdate,
    },
    contract: {
      findUnique: contractFindUnique,
      findFirst: contractFindFirst,
      create: contractCreate,
    },
  };

  return {
    proposalFindFirst,
    proposalFindUnique,
    proposalUpdateMany,
    proposalUpdate,
    contractFindUnique,
    contractFindFirst,
    contractCreate,
    workspaceFindUnique,
    tx,
  };
});

vi.mock("../../prisma/client", () => ({
  prisma: {
    proposal: {
      findFirst: mocks.proposalFindFirst,
    },
    workspace: {
      findUnique: mocks.workspaceFindUnique,
    },
    $transaction: (cb: (tx: unknown) => unknown) => cb(mocks.tx),
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
  getTenantId: () => "tenant-1",
}));

vi.mock("../lib/financial/proposal-notifications", () => ({
  notifyProposalEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  acceptProposal,
  getProposalPublic,
} from "../lib/financial/proposals-service";

const publicProposal = {
  id: "proposal-1",
  token: "legacy-token",
  publicSlug: "proposta-teste-a1b2c3d4e5f6a7b8",
  status: "accepted",
  htmlSnapshot: "<p>Conteúdo</p>",
  title: "Proposta Teste",
  code: "PRP-2026-0001",
  locale: "pt-BR",
  acceptedAt: null,
  acceptedByName: null,
  rejectedAt: null,
  rejectedReason: null,
  viewedAt: "2026-08-03",
  client: { name: "Cliente" },
};

describe("proposal public links", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof m === "function") m.mockReset();
    });
    mocks.workspaceFindUnique.mockResolvedValue({ companyName: "SeOrganize+", logoUrl: null });
  });

  it("resolves a friendly slug without removing legacy token lookup", async () => {
    mocks.proposalFindFirst.mockResolvedValue(publicProposal);

    await getProposalPublic(publicProposal.publicSlug);

    expect(mocks.proposalFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { token: publicProposal.publicSlug },
          { publicSlug: publicProposal.publicSlug },
        ],
      },
      include: { client: { select: { name: true } } },
    });
  });

  it("accepts a proposal through the same friendly-or-legacy identifier", async () => {
    mocks.proposalFindFirst.mockResolvedValue({
      ...publicProposal,
      status: "sent",
      viewedAt: null,
    });
    mocks.proposalFindUnique.mockResolvedValue({
      ...publicProposal,
      status: "sent",
      items: [],
    });
    mocks.proposalUpdateMany.mockResolvedValue({ count: 1 });
    mocks.contractFindUnique.mockResolvedValue(null);
    mocks.contractFindFirst.mockResolvedValue(null);
    mocks.contractCreate.mockResolvedValue({ id: "contract-1" });
    mocks.proposalUpdate.mockResolvedValue({ ...publicProposal, status: "accepted" });

    await acceptProposal(publicProposal.publicSlug, "Cliente");

    expect(mocks.proposalFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { token: publicProposal.publicSlug },
          { publicSlug: publicProposal.publicSlug },
        ],
      },
    });
    expect(mocks.proposalUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: publicProposal.id, status: { not: "accepted" }, contractId: null },
      })
    );
  });
});
