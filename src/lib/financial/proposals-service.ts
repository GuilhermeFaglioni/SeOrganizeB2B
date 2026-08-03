import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { FinancialValidationError } from "./lifecycle";
import { prisma } from "../../../prisma/client";
import { makeProposalPublicSlug } from "./proposal-slug";
import { toDecimal } from "./money";
import {
  renderProposalHtml,
  sanitizeProposalHtml,
  proposalDateFormatter,
  proposalMoneyFormatter,
  isProposalStatus,
  type ProposalItemData,
} from "./proposals";

export function proposalCode(year: number, sequence: number): string {
  return `PRP-${year}-${String(sequence).padStart(4, "0")}`;
}

export async function nextProposalCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PRP-${year}-`;
  const last = await tx.proposal.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const sequence = last ? parseInt(last.code.slice(-4), 10) + 1 : 1;
  return proposalCode(year, sequence);
}

export interface ProposalDraftInput {
  title: string;
  clientId: string;
  templateId?: string | null;
  variables?: Record<string, string>;
  totalValue?: string | null;
  issueDate?: string | null;
  validUntil?: string | null;
  items?: ProposalItemData[];
}

export interface ProposalListFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}

const PROPOSAL_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  template: { select: { id: true, name: true } },
  items: { orderBy: { position: "asc" } },
} as const;

async function creatorLocale(actorId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { id: actorId },
    select: { locale: true },
  });
  return profile?.locale ?? "pt-BR";
}

export async function createProposalDraft(
  input: ProposalDraftInput,
  actorId: string
) {
  if (!input.title.trim()) throw new FinancialValidationError("A title is required");
  if (!input.clientId) throw new FinancialValidationError("A client is required");

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true },
  });
  if (!client) throw new FinancialValidationError("Client not found");

  const locale = await creatorLocale(actorId);

  return prisma.$transaction(async (tx) => {
    const code = await nextProposalCode(tx);
    return tx.proposal.create({
      data: {
        code,
        token: randomUUID(),
        publicSlug: makeProposalPublicSlug(input.title),
        title: input.title.trim(),
        clientId: input.clientId,
        templateId: input.templateId ?? null,
        createdBy: actorId,
        status: "draft",
        htmlSnapshot: "",
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        totalValue: input.totalValue ? toDecimal(input.totalValue) : null,
        issueDate: input.issueDate ?? null,
        validUntil: input.validUntil ?? null,
        locale,
        items: input.items?.length
          ? {
              create: input.items.map((item, index) => ({
                name: item.name,
                description: item.description ?? null,
                quantity: item.quantity ? toDecimal(item.quantity) : null,
                price: item.price ? toDecimal(item.price) : null,
                position: item.position ?? index,
              })),
            }
          : undefined,
      },
      include: PROPOSAL_INCLUDE,
    });
  });
}

export async function updateProposalDraft(
  proposalId: string,
  input: ProposalDraftInput
) {
  const existing = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, status: true },
  });
  if (!existing) throw new FinancialValidationError("Proposal not found");
  if (existing.status !== "draft") {
    throw new FinancialValidationError("Only draft proposals can be edited");
  }

  if (input.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true },
    });
    if (!client) throw new FinancialValidationError("Client not found");
  }

  const data: Prisma.ProposalUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.clientId !== undefined) data.client = { connect: { id: input.clientId } };
  if (input.templateId !== undefined) {
    data.template = input.templateId
      ? { connect: { id: input.templateId } }
      : { disconnect: true };
  }
  if (input.variables !== undefined) data.variables = input.variables as Prisma.InputJsonValue;
  if (input.totalValue !== undefined) data.totalValue = input.totalValue ? toDecimal(input.totalValue) : null;
  if (input.issueDate !== undefined) data.issueDate = input.issueDate ?? null;
  if (input.validUntil !== undefined) data.validUntil = input.validUntil ?? null;

  return prisma.$transaction(async (tx) => {
    if (input.items !== undefined) {
      await tx.proposalItem.deleteMany({ where: { proposalId } });
      if (input.items.length > 0) {
        await tx.proposalItem.createMany({
          data: input.items.map((item, index) => ({
            proposalId,
            name: item.name,
            description: item.description ?? null,
            quantity: item.quantity ? toDecimal(item.quantity) : null,
            price: item.price ? toDecimal(item.price) : null,
            position: item.position ?? index,
          })),
        });
      }
    }
    return tx.proposal.update({
      where: { id: proposalId },
      data,
      include: PROPOSAL_INCLUDE,
    });
  });
}

async function buildSystemValues(
  proposal: {
    code: string;
    title: string;
    totalValue: Prisma.Decimal | null;
    issueDate: string | null;
    validUntil: string | null;
    client: { name: string; legalName: string | null; email: string | null; phone: string | null; cpfCnpj: string | null } | null;
  },
  locale: string
): Promise<Record<string, string>> {
  return {
    "cliente.nome": proposal.client?.name ?? "",
    "cliente.razao_social": proposal.client?.legalName ?? "",
    "cliente.email": proposal.client?.email ?? "",
    "cliente.telefone": proposal.client?.phone ?? "",
    "cliente.cpf_cnpj": proposal.client?.cpfCnpj ?? "",
    "proposta.numero": proposal.code,
    "proposta.titulo": proposal.title,
    "proposta.data": proposalDateFormatter(proposal.issueDate, locale),
    "proposta.validade": proposalDateFormatter(proposal.validUntil, locale),
    "proposta.valor_total": proposal.totalValue
      ? proposalMoneyFormatter(proposal.totalValue.toFixed(2), locale)
      : "",
  };
}

export async function sendProposal(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: {
        select: {
          name: true,
          legalName: true,
          email: true,
          phone: true,
          cpfCnpj: true,
        },
      },
      template: { select: { html: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!proposal) throw new FinancialValidationError("Proposal not found");
  if (proposal.status !== "draft") {
    throw new FinancialValidationError("Only draft proposals can be sent");
  }
  if (!proposal.template) {
    throw new FinancialValidationError("A template is required to send the proposal");
  }
  const templateHtml = sanitizeProposalHtml(proposal.template.html);
  if (!templateHtml.trim()) {
    throw new FinancialValidationError("The template has no content to render");
  }

  const variables = (proposal.variables ?? {}) as Record<string, string>;
  const systemValues = await buildSystemValues(proposal, proposal.locale);
  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
  });

  const snapshot = renderProposalHtml(templateHtml, {
    values: { ...variables, ...systemValues },
    items: proposal.items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity ? item.quantity.toFixed(2) : null,
      price: item.price ? item.price.toFixed(2) : null,
      position: item.position,
    })),
    companyName: workspace?.companyName ?? null,
    companyLogoUrl: workspace?.logoUrl ?? null,
    locale: proposal.locale,
  });

  return prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "sent", htmlSnapshot: snapshot },
    include: PROPOSAL_INCLUDE,
  });
}

function proposalIdentifierWhere(identifier: string) {
  return { OR: [{ token: identifier }, { publicSlug: identifier }] };
}

export async function acceptProposal(identifier: string, name: string) {
  if (!name.trim()) throw new FinancialValidationError("The acceptor name is required");
  const proposal = await prisma.proposal.findFirst({
    where: proposalIdentifierWhere(identifier),
  });
  if (!proposal) throw new FinancialValidationError("Proposal not found");
  if (proposal.status === "draft") {
    throw new FinancialValidationError("This proposal is not available");
  }
  if (proposal.status === "accepted") {
    throw new FinancialValidationError("This proposal has already been accepted");
  }
  if (proposal.status === "rejected") {
    throw new FinancialValidationError("This proposal has been rejected");
  }

  const today = new Date().toISOString().slice(0, 10);
  return prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: "accepted",
      acceptedAt: today,
      acceptedByName: name.trim(),
      viewedAt: proposal.viewedAt ?? today,
    },
  });
}

export async function rejectProposal(
  proposalId: string,
  reason?: string | null
) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, status: true },
  });
  if (!proposal) throw new FinancialValidationError("Proposal not found");
  if (proposal.status === "draft") {
    throw new FinancialValidationError("Only sent proposals can be rejected");
  }
  if (proposal.status === "accepted") {
    throw new FinancialValidationError("This proposal has already been accepted");
  }

  const today = new Date().toISOString().slice(0, 10);
  return prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: "rejected",
      rejectedAt: today,
      rejectedReason: reason ?? null,
    },
  });
}

export async function cloneProposal(proposalId: string, actorId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { items: true },
  });
  if (!proposal) throw new FinancialValidationError("Proposal not found");

  return prisma.$transaction(async (tx) => {
    const code = await nextProposalCode(tx);
    return tx.proposal.create({
      data: {
        code,
        token: randomUUID(),
        publicSlug: makeProposalPublicSlug(proposal.title),
        title: proposal.title,
        clientId: proposal.clientId,
        templateId: proposal.templateId,
        createdBy: actorId,
        status: "draft",
        htmlSnapshot: "",
        variables: proposal.variables as Prisma.InputJsonValue,
        totalValue: proposal.totalValue,
        issueDate: proposal.issueDate,
        validUntil: proposal.validUntil,
        locale: proposal.locale,
        items: proposal.items.length
          ? {
              create: proposal.items.map((item) => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                price: item.price,
                position: item.position,
              })),
            }
          : undefined,
      },
      include: PROPOSAL_INCLUDE,
    });
  });
}

export async function getProposal(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: PROPOSAL_INCLUDE,
  });
  if (!proposal) return null;
  return proposal;
}

export async function deleteProposal(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true },
  });
  if (!proposal) throw new FinancialValidationError("Proposal not found");
  await prisma.proposal.delete({ where: { id: proposalId } });
}

export async function listProposals(filters: ProposalListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const sortBy = filters.sortBy ?? "createdAt";
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  const where: Prisma.ProposalWhereInput = {};
  if (filters.status && isProposalStatus(filters.status)) {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { client: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.ProposalOrderByWithRelationInput =
    sortBy === "client"
      ? { client: { name: sortDir } }
      : { [sortBy]: sortDir };

  const [total, items] = await Promise.all([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: PROPOSAL_INCLUDE,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProposalPublic(identifier: string) {
  const proposal = await prisma.proposal.findFirst({
    where: proposalIdentifierWhere(identifier),
    include: { client: { select: { name: true } } },
  });
  if (!proposal) return null;

  if (proposal.status === "draft") {
    return { status: "draft" as const };
  }

  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
  });

  if (proposal.status !== "rejected" && proposal.status !== "accepted") {
    const today = new Date().toISOString().slice(0, 10);
    if (!proposal.viewedAt) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { viewedAt: today, status: "viewed" },
      });
    }
  }

  return {
    status: proposal.status,
    htmlSnapshot: proposal.htmlSnapshot,
    title: proposal.title,
    code: proposal.code,
    clientName: proposal.client?.name ?? "",
    companyName: workspace?.companyName ?? null,
    logoUrl: workspace?.logoUrl ?? null,
    acceptedAt: proposal.acceptedAt,
    acceptedByName: proposal.acceptedByName,
    rejectedAt: proposal.rejectedAt,
    rejectedReason: proposal.rejectedReason,
    locale: proposal.locale,
  };
}
