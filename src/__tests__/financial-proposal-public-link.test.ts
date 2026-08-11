import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  proposalFindFirst: vi.fn(),
  proposalUpdate: vi.fn(),
  workspaceFindUnique: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    proposal: {
      findFirst: mocks.proposalFindFirst,
      update: mocks.proposalUpdate,
    },
    workspace: {
      findUnique: mocks.workspaceFindUnique,
    },
  },
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
    mocks.proposalFindFirst.mockReset();
    mocks.proposalUpdate.mockReset();
    mocks.workspaceFindUnique.mockReset();
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
    expect(mocks.proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: publicProposal.id } })
    );
  });
});
