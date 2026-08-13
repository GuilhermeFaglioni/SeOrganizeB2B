import { Prisma } from "@prisma/client";
import { prisma, requireTenantId } from "../../../prisma/client";
import { contractCode } from "./contract-code";
import {
  FinancialConflictError,
  FinancialValidationError,
  activationErrors,
  cancellationPlan,
  renewablePredecessor,
  transition,
} from "./lifecycle";
import { recordFinancialAudit } from "./audit";
import {
  adjustmentPlanItem,
  redistributeDelta,
  validateDownsell,
  validateRedistributedPlan,
} from "./changes";
import { add, neg, sub, toDecimal } from "./money";
import type {
  ChangeType,
  InstallmentPlanItem,
  LifecycleAction,
  PaymentMethod,
} from "./types";

type ProposalForContract = {
  id: string;
  title: string;
  clientId: string;
  totalValue: Prisma.Decimal | null;
  tenantId: string;
  createdBy: string;
  items: Array<{
    name: string;
    description: string | null;
    quantity: Prisma.Decimal | null;
    price: Prisma.Decimal | null;
    position: number;
  }>;
};

/** Creates the pre-filled draft while the proposal acceptance transaction is open. */
export async function createContractDraftFromProposal(
  tx: Prisma.TransactionClient,
  proposal: ProposalForContract
) {
  const existing = await tx.proposal.findUnique({
    where: { id: proposal.id },
    select: { contractId: true },
  });
  if (existing?.contractId) {
    return tx.contract.findUnique({
      where: { id: existing.contractId },
      include: { client: true, items: true, projects: true },
    });
  }

  const contract = await tx.contract.create({
    data: {
      code: await nextContractCode(tx),
      title: proposal.title,
      clientId: proposal.clientId,
      ownerId: proposal.createdBy,
      status: "draft",
      officialValue: proposal.totalValue,
      startDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "pix",
      tenantId: proposal.tenantId,
      items: {
        create: proposal.items.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          position: item.position,
          tenantId: proposal.tenantId,
        })),
      },
    },
    include: { client: true, items: true, projects: true },
  });

  await tx.proposal.update({
    where: { id: proposal.id },
    data: { contractId: contract.id },
  });
  return contract;
}

export async function nextContractCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `CTR-${year}-`;
  const last = await tx.contract.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const sequence = last ? parseInt(last.code.slice(-4), 10) + 1 : 1;
  return contractCode(year, sequence);
}

export interface ContractDraftInput {
  title: string;
  clientId: string;
  ownerId?: string | null;
  durationType: string;
  officialValue: string;
  startDate: string;
  endDate?: string | null;
  billingFrequency?: string | null;
  paymentMethod: PaymentMethod;
  documentUrl?: string | null;
  notes?: string | null;
  items?: Array<{
    name: string;
    description?: string | null;
    quantity?: string | null;
    unit?: string | null;
    price?: string | null;
    position: number;
  }>;
  projectIds?: string[];
}

export async function createContractDraft(
  input: ContractDraftInput,
  actorId: string // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  return prisma.$transaction(async (tx) => {
    const code = await nextContractCode(tx);
    return tx.contract.create({
      data: {
        code,
        title: input.title,
        clientId: input.clientId,
        ownerId: input.ownerId ?? null,
        status: "draft",
        durationType: input.durationType,
        officialValue: toDecimal(input.officialValue),
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        billingFrequency: input.billingFrequency ?? null,
        paymentMethod: input.paymentMethod,
        documentUrl: input.documentUrl ?? null,
        notes: input.notes ?? null,
        tenantId: requireTenantId("financial.contracts"),
        items: input.items?.length
          ? {
              create: input.items.map((item) => ({
                name: item.name,
                description: item.description ?? null,
                quantity: item.quantity ? toDecimal(item.quantity) : null,
                unit: item.unit ?? null,
                price: item.price ? toDecimal(item.price) : null,
                position: item.position,
                tenantId: requireTenantId("financial.contracts"),
              })),
            }
          : undefined,
        projects: input.projectIds?.length
          ? {
              create: input.projectIds.map((projectId) => ({
                projectId,
                tenantId: requireTenantId("financial.contracts"),
              })),
            }
          : undefined,
      },
      include: { client: true, items: true, projects: true },
    });
  });
}

export interface ContractUpdateInput {
  title?: string;
  clientId?: string;
  ownerId?: string | null;
  durationType?: string;
  officialValue?: string;
  startDate?: string;
  endDate?: string | null;
  billingFrequency?: string | null;
  paymentMethod?: PaymentMethod;
  documentUrl?: string | null;
  notes?: string | null;
  items?: Array<{
    name: string;
    description?: string | null;
    quantity?: string | null;
    unit?: string | null;
    price?: string | null;
    position: number;
  }>;
  projectIds?: string[];
}

export async function updateContract(
  contractId: string,
  input: ContractUpdateInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { items: { orderBy: { position: "asc" } }, projects: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft" && contract.status !== "active") {
      throw new FinancialConflictError(
        "Only draft and active contracts can be edited"
      );
    }
    const financialFields: Array<keyof ContractUpdateInput> = [
      "officialValue",
      "startDate",
      "endDate",
      "billingFrequency",
      "durationType",
    ];
    for (const field of financialFields) {
      const next = input[field];
      if (next !== undefined) {
        await recordFinancialAudit(tx, {
          contractId,
          actorId,
          field,
          beforeValue: String(
            (contract as Record<string, unknown>)[field]
          ),
          afterValue: String(next),
        });
      }
    }

    if (input.items !== undefined) {
      const beforeItems = contract.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity?.toString() ?? null,
        unit: item.unit,
        price: item.price?.toString() ?? null,
        position: item.position,
      }));
      await tx.contractItem.deleteMany({ where: { contractId } });
      if (input.items.length > 0) {
        await tx.contractItem.createMany({
          data: input.items.map((item) => ({
            contractId,
            name: item.name,
            description: item.description ?? null,
            quantity: item.quantity ? toDecimal(item.quantity) : null,
            unit: item.unit ?? null,
            price: item.price ? toDecimal(item.price) : null,
            position: item.position,
            tenantId: requireTenantId("financial.contracts"),
          })),
        });
      }
      await recordFinancialAudit(tx, {
        contractId,
        actorId,
        field: "items",
        beforeValue: beforeItems,
        afterValue: input.items,
      });
    }

    if (input.projectIds !== undefined) {
      const beforeProjects = contract.projects.map((p) => p.projectId);

      if (contract.status === "active") {
        for (const projectId of input.projectIds) {
          const conflict = await tx.contractProject.findFirst({
            where: {
              projectId,
              contract: {
                status: "active",
                id: { not: contractId },
              },
            },
            select: { contractId: true },
          });
          if (conflict) {
            throw new FinancialConflictError(
              "A linked project already belongs to another active contract"
            );
          }
        }
      }

      await tx.contractProject.deleteMany({ where: { contractId } });
      if (input.projectIds.length > 0) {
        await tx.contractProject.createMany({
          data: input.projectIds.map((projectId) => ({
            contractId,
            projectId,
            tenantId: requireTenantId("financial.contracts"),
          })),
        });
      }
      await recordFinancialAudit(tx, {
        contractId,
        actorId,
        field: "projects",
        beforeValue: beforeProjects,
        afterValue: input.projectIds,
      });
    }

    const data: Prisma.ContractUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.clientId !== undefined) data.client = { connect: { id: input.clientId } };
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId
        ? { connect: { id: input.ownerId } }
        : { disconnect: true };
    }
    if (input.durationType !== undefined) data.durationType = input.durationType;
    if (input.officialValue !== undefined) data.officialValue = toDecimal(input.officialValue);
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.billingFrequency !== undefined) data.billingFrequency = input.billingFrequency;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.documentUrl !== undefined) data.documentUrl = input.documentUrl;
    if (input.notes !== undefined) data.notes = input.notes;
    return tx.contract.update({
      where: { id: contractId },
      data,
      include: { client: true, items: true, projects: true },
    });
  });
}

export async function deleteContract(contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    await tx.contract.delete({ where: { id: contractId } });
  });
}

export async function activateContract(
  contractId: string,
  plan: InstallmentPlanItem[],
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    return activateContractInTransaction(tx, contractId, plan, actorId);
  });
}

export interface ConfirmContractInput {
  durationType: string;
  billingFrequency?: string | null;
  startDate: string;
  endDate?: string | null;
  paymentMethod: PaymentMethod;
  plan: InstallmentPlanItem[];
}

/** Updates confirmation fields and activates in the same database transaction. */
export async function confirmContract(
  contractId: string,
  input: ConfirmContractInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft") {
      throw new FinancialConflictError(
        "Only draft contracts can be activated"
      );
    }

    await tx.contract.update({
      where: { id: contractId },
      data: {
        durationType: input.durationType,
        billingFrequency: input.billingFrequency ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        paymentMethod: input.paymentMethod,
      },
    });

    return activateContractInTransaction(tx, contractId, input.plan, actorId);
  });
}

async function activateContractInTransaction(
  tx: Prisma.TransactionClient,
  contractId: string,
  plan: InstallmentPlanItem[],
  actorId: string
) {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { projects: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft") {
      throw new FinancialConflictError(
        "Only draft contracts can be activated"
      );
    }

    const errors = activationErrors(
      {
        clientId: contract.clientId ?? "",
        title: contract.title ?? "",
        durationType: contract.durationType ?? "",
        officialValue: contract.officialValue ?? toDecimal(0),
        startDate: contract.startDate ?? "",
        endDate: contract.endDate ?? null,
        billingFrequency: contract.billingFrequency ?? null,
      },
      plan
    );
    if (errors.length > 0) {
      throw new FinancialValidationError(errors.join("; "));
    }

    for (const link of contract.projects) {
      const conflict = await tx.contractProject.findFirst({
        where: {
          projectId: link.projectId,
          contract: {
            status: "active",
            id: {
              not: contractId,
              notIn: contract.predecessorId ? [contract.predecessorId] : [],
            },
          },
        },
        select: { contractId: true },
      });
      if (conflict) {
        throw new FinancialConflictError(
          "A linked project already belongs to another active contract"
        );
      }
    }

    const predecessor = contract.predecessorId
      ? await tx.contract.findUnique({
          where: { id: contract.predecessorId },
          select: { status: true },
        })
      : null;
    if (
      contract.predecessorId &&
      predecessor &&
      !renewablePredecessor(predecessor.status)
    ) {
      throw new FinancialConflictError(
        "Predecessor is not in a renewable state"
      );
    }

    await tx.installment.createMany({
      data: plan.map((item) => ({
        contractId,
        expectedAmount: toDecimal(item.expectedAmount),
        dueDate: item.dueDate,
        paymentMethod: item.paymentMethod,
        status: "pending",
        cycleKey:
          contract.durationType === "openEnded"
            ? item.dueDate.slice(0, 7)
            : null,
        tenantId: requireTenantId("financial.contracts"),
      })),
    });

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: "active" },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "status",
      beforeValue: "draft",
      afterValue: "active",
    });

    if (contract.predecessorId) {
      await tx.contractProject.deleteMany({
        where: { contractId: contract.predecessorId },
      });
      await tx.contract.update({
        where: { id: contract.predecessorId },
        data: { status: "closed" },
      });
    }

    return updated;
}

export interface LifecyclePayload {
  effectiveDate?: string;
  retainedInstallmentIds?: string[];
}

export async function applyLifecycleAction(
  contractId: string,
  action: Exclude<LifecycleAction, "renew"> | "renew",
  payload: LifecyclePayload,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { items: true, projects: true, installments: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");

    if (action === "renew") {
      if (!renewablePredecessor(contract.status)) {
        throw new FinancialConflictError(
          "Only active or suspended contracts can be renewed"
        );
      }
      const code = await nextContractCode(tx);
      const renewal = await tx.contract.create({
        data: {
          code,
          title: contract.title,
          clientId: contract.clientId,
          ownerId: contract.ownerId,
          status: "draft",
          durationType: contract.durationType,
          officialValue: contract.officialValue,
          startDate: contract.startDate,
          endDate: contract.endDate,
          billingFrequency: contract.billingFrequency,
          paymentMethod: contract.paymentMethod as PaymentMethod,
          documentUrl: contract.documentUrl,
          notes: contract.notes,
          predecessorId: contract.id,
          tenantId: requireTenantId("financial.contracts"),
          items: {
            create: contract.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              position: item.position,
              tenantId: requireTenantId("financial.contracts"),
            })),
          },
          projects: {
            create: contract.projects.map((project) => ({
              projectId: project.projectId,
              tenantId: requireTenantId("financial.contracts"),
            })),
          },
        },
      });
      await recordFinancialAudit(tx, {
        contractId,
        actorId,
        field: "renewal",
        afterValue: renewal.id,
      });
      return renewal;
    }

    if (action === "cancel") {
      if (!payload.effectiveDate) {
        throw new FinancialValidationError(
          "An effective date is required to cancel a contract"
        );
      }
      const cancelledIds = cancellationPlan(
        contract.installments,
        payload.effectiveDate,
        payload.retainedInstallmentIds ?? []
      );
      if (cancelledIds.length > 0) {
        await tx.installment.updateMany({
          where: { id: { in: cancelledIds } },
          data: { status: "cancelled" },
        });
      }
    }

    const status = transition(contract.status, action);
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "status",
      beforeValue: contract.status,
      afterValue: status,
      reason:
        action === "cancel" ? `Cancelled effective ${payload.effectiveDate}` : undefined,
    });

    return updated;
  });
}

export interface ContractChangeInput {
  type: ChangeType;
  delta: string;
  effectiveDate: string;
  description?: string;
  reason?: string;
  strategy: "redistribute" | "adjust";
  confirm?: boolean;
}

export async function applyContractChange(
  contractId: string,
  input: ContractChangeInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "active") {
      throw new FinancialConflictError("Only active contracts can be adjusted");
    }

    const delta = toDecimal(input.delta);
    const deltaErrors = validateDownsell(contract.officialValue ?? toDecimal(0), delta);
    if (deltaErrors.length > 0) {
      throw new FinancialValidationError(deltaErrors.join("; "));
    }

    const pending = contract.installments.filter((i) => i.status === "pending");

    if (!input.confirm) {
      const proposal =
        input.strategy === "redistribute"
          ? {
              strategy: "redistribute",
              installments: redistributeDelta(
                pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount })),
                delta,
                input.type
              ),
            }
          : {
              strategy: "adjust",
              installments: [
                adjustmentPlanItem(
                  input.type,
                  delta,
                  input.effectiveDate,
                  contract.paymentMethod as PaymentMethod
                ),
              ],
            };
      return { applied: false, proposal };
    }

    if (input.strategy === "redistribute") {
      const adjusted = redistributeDelta(
        pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount })),
        delta,
        input.type
      );
      const invalid = validateRedistributedPlan(adjusted);
      if (invalid.length > 0) {
        throw new FinancialValidationError(invalid.join("; "));
      }
      for (const item of adjusted) {
        await tx.installment.update({
          where: { id: item.id },
          data: { expectedAmount: item.expectedAmount },
        });
      }
    } else {
      await tx.installment.create({
        data: {
          contractId,
          expectedAmount:
            input.type === "downsell" ? neg(delta) : delta,
          dueDate: input.effectiveDate,
          paymentMethod: contract.paymentMethod,
          status: "pending",
          cycleKey: null,
          tenantId: requireTenantId("financial.contracts"),
        },
      });
    }

    const previousValue = contract.officialValue ?? toDecimal(0);
    const newValue =
      input.type === "upsell"
        ? add(previousValue, delta)
        : sub(previousValue, delta);

    await tx.contract.update({
      where: { id: contractId },
      data: { officialValue: newValue },
    });

    await tx.contractChange.create({
      data: {
        contractId,
        type: input.type,
        delta,
        effectiveDate: input.effectiveDate,
        description: input.description ?? null,
        previousValue,
        newValue,
        reason: input.reason ?? null,
        actorId,
        tenantId: requireTenantId("financial.contracts"),
      },
    });

    await recordFinancialAudit(tx, {
      contractId,
      actorId,
      field: "officialValue",
      beforeValue: previousValue.toFixed(2),
      afterValue: newValue.toFixed(2),
      reason: input.reason,
    });

    return {
      applied: true,
      contract: await tx.contract.findUnique({ where: { id: contractId } }),
    };
  });
}
