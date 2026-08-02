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

  it("updateContract atomically replaces items and projects with audit", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain("contractItem.deleteMany");
    expect(source).toContain("contractItem.createMany");
    expect(source).toContain("contractProject.deleteMany");
    expect(source).toContain("contractProject.createMany");
    expect(source).toContain('field: "items"');
    expect(source).toContain('field: "projects"');
    expect(source).toContain("beforeValue: beforeItems");
    expect(source).toContain("afterValue: input.items");
    expect(source).toContain("beforeValue: beforeProjects");
    expect(source).toContain("afterValue: input.projectIds");
  });

  it("updateContract checks project uniqueness for active contracts", () => {
    const source = read("src/lib/financial/contracts-service.ts");
    expect(source).toContain('contract.status === "active"');
    expect(source).toContain("A linked project already belongs to another active contract");
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
