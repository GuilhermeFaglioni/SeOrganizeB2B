import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { tenantFilter, withTenant } from "../../prisma/middleware/tenant-filter";

type MiddlewareParams = Prisma.MiddlewareParams;

function makeNext() {
  return vi.fn(async (params: MiddlewareParams) => ({ received: params }));
}

function makeParams(overrides: Partial<MiddlewareParams>): MiddlewareParams {
  return {
    model: "AiProviderConnection",
    action: "findMany",
    args: {},
    dataPath: [],
    runInTransaction: false,
    ...overrides,
  };
}

describe("AI connection tenant isolation", () => {
  it("injects tenantId into AiProviderConnection reads", async () => {
    const next = makeNext();
    const params = makeParams({ action: "findMany" });

    await withTenant("tenant-a", () => tenantFilter(params, next));

    expect(params.args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("injects tenantId into AiProviderConnection writes", async () => {
    const next = makeNext();
    const params = makeParams({
      action: "create",
      args: { data: { provider: "openai" } },
    });

    await withTenant("tenant-a", () => tenantFilter(params, next));

    expect(params.args.data).toEqual({ provider: "openai", tenantId: "tenant-a" });
  });

  it("injects tenantId into AiProviderConnectionAudit reads", async () => {
    const next = makeNext();
    const params = makeParams({
      model: "AiProviderConnectionAudit",
      action: "findMany",
    });

    await withTenant("tenant-a", () => tenantFilter(params, next));

    expect(params.args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("fails closed without a tenant context", async () => {
    const params = makeParams({ action: "findMany" });

    await expect(tenantFilter(params, makeNext())).rejects.toMatchObject({
      code: "TENANT_CONTEXT_REQUIRED",
    });
  });
});
