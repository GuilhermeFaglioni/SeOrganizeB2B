import { FinancialValidationError } from "./lifecycle";
import { prisma, requireTenantId } from "../../../prisma/client";

export interface TemplateInput {
  name: string;
  html: string;
  cycleId?: string | null;
}

export async function listProposalTemplates() {
  return prisma.proposalTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getProposalTemplate(templateId: string) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) return null;
  return template;
}

export async function createProposalTemplate(
  input: TemplateInput,
  actorId: string
) {
  if (!input.name.trim()) {
    throw new FinancialValidationError("A template name is required");
  }
  const tenantId = requireTenantId("financial.proposal-templates");
  return prisma.$transaction(async (tx) => {
    const template = await tx.proposalTemplate.create({ data: { name: input.name.trim(), html: input.html, createdBy: actorId, tenantId } });
    if (input.cycleId) await tx.aiStudioManagedCycle.updateMany({ where: { id: input.cycleId, tenantId, actorId, status: "active" }, data: { status: "saved" } });
    return template;
  });
}

export async function updateProposalTemplate(
  templateId: string,
  input: Partial<TemplateInput>,
  actorId?: string,
) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!template) throw new FinancialValidationError("Template not found");

  const data: { name?: string; html?: string } = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.html !== undefined) data.html = input.html;
  if (!data.name && data.html === undefined) {
    throw new FinancialValidationError("Nothing to update");
  }

  const tenantId = requireTenantId("financial.proposal-templates");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.proposalTemplate.update({ where: { id: templateId }, data });
    if (input.cycleId && actorId) await tx.aiStudioManagedCycle.updateMany({ where: { id: input.cycleId, tenantId, actorId, status: "active" }, data: { status: "saved" } });
    return updated;
  });
}

export async function deleteProposalTemplate(templateId: string) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, _count: { select: { proposals: true } } },
  });
  if (!template) throw new FinancialValidationError("Template not found");
  if (template._count.proposals > 0) {
    throw new FinancialValidationError(
      "This template is used by existing proposals and cannot be deleted"
    );
  }
  await prisma.proposalTemplate.delete({ where: { id: templateId } });
}
