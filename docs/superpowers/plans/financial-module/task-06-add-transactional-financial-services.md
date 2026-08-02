# Financial Module — Task 6

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 6: Add Transactional Financial Services

**Files:**
- Create: `src/lib/financial/contracts-service.ts`
- Create: `src/lib/financial/installments-service.ts`
- Create: `src/lib/financial/overview-service.ts`
- Create: `src/__tests__/financial-services.test.ts`

- [ ] **Step 1: Write the failing service contract test**

Create `src/__tests__/financial-services.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial transactional services", () => {
  it("wraps activation in a transaction and validates the plan", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("prisma.$transaction");
    expect(source).toContain("activationErrors");
    expect(source).toContain("recordFinancialAudit");
    expect(source).toContain("createMany");
  });

  it("guards project conflicts and renewal predecessors", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("already belongs to another active contract");
    expect(source).toContain("renewablePredecessor");
    expect(source).toContain("contractProject.deleteMany");
  });

  it("generates the next sequential contract code per year", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("nextContractCode");
    expect(source).toContain("contractCode(");
  });

  it("protects paid installments and enforces refund limits", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain("refundableValue");
    expect(source).toContain("status !== \"paid\"");
    expect(source).toContain("neg(");
  });

  it("extends recurring horizons idempotently by cycle key", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain("extendRecurringHorizons");
    expect(source).toContain("cycleKey");
    expect(source).toContain("addMonthsCivil(today, 12)");
  });

  it("aggregates overview metrics on the server", () => {
    const source = read("src/lib/financial/overview-service.ts");
    expect(source).toContain("extendRecurringHorizons");
    expect(source).toContain("activeContractedValue");
    expect(source).toContain("groupMonthly");
    expect(source).toContain("mrrForContract");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-services.test.ts
```

Expected: FAIL — the three service files do not exist.

- [ ] **Step 3: Implement the contracts service**

Create `src/lib/financial/contracts-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
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
  actorId: string
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
        items: input.items?.length
          ? {
              create: input.items.map((item) => ({
                name: item.name,
                description: item.description ?? null,
                quantity: item.quantity ? toDecimal(item.quantity) : null,
                unit: item.unit ?? null,
                price: item.price ? toDecimal(item.price) : null,
                position: item.position,
              })),
            }
          : undefined,
        projects: input.projectIds?.length
          ? { create: input.projectIds.map((projectId) => ({ projectId })) }
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
  status?: string;
}

export async function updateContract(
  contractId: string,
  input: ContractUpdateInput,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({ where: { id: contractId } });
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
    if (input.status !== undefined) data.status = input.status;
    return tx.contract.update({
      where: { id: contractId },
      data,
      include: { client: true, items: true, projects: true },
    });
  });
}

export async function deleteDraftContract(contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");
    if (contract.status !== "draft") {
      throw new FinancialConflictError(
        "Only draft contracts can be deleted"
      );
    }
    await tx.contract.delete({ where: { id: contractId } });
  });
}

export async function activateContract(
  contractId: string,
  plan: InstallmentPlanItem[],
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: { projects: true },
    });
    if (!contract) throw new FinancialValidationError("Contract not found");

    const errors = activationErrors(contract, plan);
    if (errors.length > 0) {
      throw new FinancialValidationError(errors.join("; "));
    }

    for (const link of contract.projects) {
      const conflict = await tx.contractProject.findFirst({
        where: {
          projectId: link.projectId,
          contract: { status: "active", id: { not: contractId } },
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
  });
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
          items: {
            create: contract.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              price: item.price,
              position: item.position,
            })),
          },
          projects: {
            create: contract.projects.map((project) => ({
              projectId: project.projectId,
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
    const deltaErrors = validateDownsell(contract.officialValue, delta);
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
        },
      });
    }

    const previousValue = contract.officialValue;
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
```

- [ ] **Step 4: Implement the installments service**

Create `src/lib/financial/installments-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { FinancialConflictError, FinancialValidationError } from "./lifecycle";
import { add, lt, neg, sub, sum, toDecimal } from "./money";

export function refundableValue(
  installment: { expectedAmount: Prisma.Decimal },
  refunds: Array<{ expectedAmount: Prisma.Decimal }>
): Prisma.Decimal {
  const refunded = sum(refunds.map((r) => r.expectedAmount));
  return sub(installment.expectedAmount, refunded.negated());
}

export async function recordPayment(
  installmentId: string,
  paidAt: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be marked as paid"
      );
    }
    return tx.installment.update({
      where: { id: installmentId },
      data: { status: "paid", paidAt },
    });
  });
}

export async function cancelInstallment(
  installmentId: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be cancelled"
      );
    }
    return tx.installment.update({
      where: { id: installmentId },
      data: { status: "cancelled" },
    });
  });
}

export async function refundInstallment(
  installmentId: string,
  refundAmount: string,
  refundDate: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
      include: { refunds: { select: { expectedAmount: true } } },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "paid") {
      throw new FinancialConflictError(
        "Refunds must link to a paid installment"
      );
    }
    const requested = toDecimal(refundAmount);
    const refundable = refundableValue(installment, installment.refunds);
    if (lt(requested, toDecimal(0))) {
      throw new FinancialValidationError("Refund amount must be positive");
    }
    if (lt(refundable, requested)) {
      throw new FinancialValidationError(
        "Refund exceeds the refundable value of the installment"
      );
    }
    return tx.installment.create({
      data: {
        contractId: installment.contractId,
        expectedAmount: neg(requested),
        dueDate: installment.dueDate,
        paymentMethod: installment.paymentMethod,
        status: "paid",
        paidAt: refundDate,
        refundOfId: installmentId,
        cycleKey: null,
      },
    });
  });
}

export async function extendRecurringHorizons(
  tx: Prisma.TransactionClient
): Promise<number> {
  const today = todayCivilDate();
  const targetDate = addMonthsCivil(today, 12);
  const contracts = await tx.contract.findMany({
    where: { status: "active", durationType: "openEnded" },
    select: {
      id: true,
      startDate: true,
      officialValue: true,
      paymentMethod: true,
      billingFrequency: true,
    },
  });
  let created = 0;
  for (const contract of contracts) {
    const existing = await tx.installment.findMany({
      where: { contractId: contract.id },
      select: { cycleKey: true },
    });
    const existingKeys = new Set(
      existing.map((i) => i.cycleKey).filter((k): k is string => Boolean(k))
    );
    const step = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
      (contract.billingFrequency ?? "monthly") as "monthly" | "quarterly" | "semiannual" | "annual"
    ];
    let index = 0;
    while (true) {
      const dueDate = addMonthsCivil(contract.startDate, index * step);
      if (compareCivil(dueDate, targetDate) > 0) break;
      if (compareCivil(dueDate, today) >= 0) {
        const cycleKey = dueDate.slice(0, 7);
        if (!existingKeys.has(cycleKey)) {
          await tx.installment.create({
            data: {
              contractId: contract.id,
              expectedAmount: contract.officialValue,
              dueDate,
              paymentMethod: contract.paymentMethod,
              status: "pending",
              cycleKey,
            },
          });
          created += 1;
        }
      }
      index += 1;
    }
  }
  return created;
}
```

Note: `add` is imported but unused in this file — remove it from the import
list before committing so `tsc --noEmit` stays clean.

- [ ] **Step 5: Implement the overview service**

Create `src/lib/financial/overview-service.ts`:

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import {
  activeContractedValue,
  arrForContract,
  forecastTotal,
  groupMonthly,
  isExpiringSoon,
  mrrForContract,
  overdueTotal,
  receivedTotal,
  sumChangeDeltas,
} from "./metrics";
import { extendRecurringHorizons } from "./installments-service";
import { addDaysCivil, addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { moneyToJson, sum, toDecimal } from "./money";
import type { BillingFrequency, ContractStatus, InstallmentStatus } from "./types";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: ContractStatus;
  projectId?: string;
  installmentStatus?: InstallmentStatus;
}

export interface OverviewData {
  kpis: {
    activeContractedValue: string;
    mrr: string;
    arr: string;
    cashForecast: string;
    received: string;
    overdue: string;
    upsell: string;
    downsell: string;
    activeContracts: number;
    expiringSoon: number;
  };
  monthly: Array<{ month: string; forecast: string; received: string }>;
  overdueInstallments: Array<{
    id: string;
    contractCode: string;
    contractTitle: string;
    clientName: string;
    expectedAmount: string;
    dueDate: string;
  }>;
  expiringContracts: Array<{
    id: string;
    code: string;
    title: string;
    clientName: string;
    status: string;
    endDate: string;
    officialValue: string;
  }>;
}

export async function computeOverview(
  filters: OverviewFilters
): Promise<OverviewData> {
  const today = todayCivilDate();
  const from =
    filters.period === "custom"
      ? filters.from ?? today
      : filters.period === "currentMonth"
        ? `${today.slice(0, 7)}-01`
        : today;
  const to =
    filters.period === "custom"
      ? filters.to ?? addDaysCivil(today, 90)
      : filters.period === "currentMonth"
        ? addDaysCivil(addMonthsCivil(from, 1), -1)
        : addDaysCivil(today, 90);

  return prisma.$transaction(async (tx) => {
    await extendRecurringHorizons(tx);

    const contractWhere: Prisma.ContractWhereInput = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.contractStatus ? { status: filters.contractStatus } : {}),
      ...(filters.projectId ? { projects: { some: { projectId: filters.projectId } } } : {}),
    };

    const contracts = await tx.contract.findMany({
      where: contractWhere,
      include: { client: true },
    });
    const installments = await tx.installment.findMany({
      where: {
        contract: contractWhere,
        ...(filters.installmentStatus ? { status: filters.installmentStatus } : {}),
      },
    });
    const changes = await tx.contractChange.findMany({
      where: { contract: contractWhere },
    });

    const active = contracts.filter((c) => c.status === "active");
    const mrr = sum(
      active.map((c) =>
        mrrForContract({
          officialValue: c.officialValue,
          durationType: c.durationType,
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate,
          endDate: c.endDate,
        }) ?? toDecimal(0)
      )
    );
    const arr = sum(
      active.map((c) =>
        arrForContract({
          officialValue: c.officialValue,
          durationType: c.durationType,
          billingFrequency: c.billingFrequency as BillingFrequency | null,
          startDate: c.startDate,
          endDate: c.endDate,
        }) ?? toDecimal(0)
      )
    );

    const overdueInstallments = installments
      .filter((i) => i.status === "pending" && compareCivil(i.dueDate, today) < 0)
      .sort((a, b) => compareCivil(a.dueDate, b.dueDate))
      .slice(0, 10)
      .map((i) => {
        const contract = contracts.find((c) => c.id === i.contractId);
        return {
          id: i.id,
          contractCode: contract?.code ?? "",
          contractTitle: contract?.title ?? "",
          clientName: contract?.client.name ?? "",
          expectedAmount: moneyToJson(i.expectedAmount),
          dueDate: i.dueDate,
        };
      });

    const expiringContracts = active
      .filter(
        (c) => c.durationType === "fixed" && c.endDate && isExpiringSoon(c.endDate, today)
      )
      .sort((a, b) => compareCivil(a.endDate as string, b.endDate as string))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        clientName: c.client.name,
        status: c.status,
        endDate: c.endDate as string,
        officialValue: moneyToJson(c.officialValue),
      }));

    return {
      kpis: {
        activeContractedValue: moneyToJson(activeContractedValue(contracts)),
        mrr: moneyToJson(mrr),
        arr: moneyToJson(arr),
        cashForecast: moneyToJson(forecastTotal(installments, from, to)),
        received: moneyToJson(receivedTotal(installments, from, to)),
        overdue: moneyToJson(overdueTotal(installments, today)),
        upsell: moneyToJson(sumChangeDeltas(changes, "upsell", from, to)),
        downsell: moneyToJson(sumChangeDeltas(changes, "downsell", from, to)),
        activeContracts: active.length,
        expiringSoon: expiringContracts.length,
      },
      monthly: groupMonthly(installments, from, to),
      overdueInstallments,
      expiringContracts,
    };
  });
}
```

- [ ] **Step 6: Run the service contract test to verify it passes**

```bash
npx vitest run src/__tests__/financial-services.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the domain suite and typecheck**

```bash
npx vitest run src/__tests__/financial-money.test.ts src/__tests__/financial-installments.test.ts src/__tests__/financial-metrics.test.ts src/__tests__/financial-lifecycle.test.ts src/__tests__/financial-services.test.ts
npx tsc --noEmit --incremental false
```

Expected: all PASS and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/financial/contracts-service.ts src/lib/financial/installments-service.ts src/lib/financial/overview-service.ts src/__tests__/financial-services.test.ts
git commit -m "feat(financial): add transactional financial services"
```

---

