import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  tenantFilter,
  withTenant,
  withTenantBypass,
  getTenantId,
  getTenantContext,
  TenantContextRequiredError,
  TENANT_CONTEXT_REQUIRED,
} from "../../prisma/middleware/tenant-filter";

type MiddlewareParams = Prisma.MiddlewareParams;

function makeNext() {
  return vi.fn(async (params: MiddlewareParams) => ({
    received: params,
    ok: true,
  }));
}

function makeParams(overrides: Partial<MiddlewareParams>): MiddlewareParams {
  return {
    model: "Task",
    action: "findMany",
    args: {},
    dataPath: [],
    runInTransaction: false,
    ...overrides,
  };
}

async function run(params: MiddlewareParams) {
  const next = makeNext();
  const result = await tenantFilter(params, next);
  return { next, result, params, args: params.args };
}

describe("tenantFilter — groupBy injection", () => {
  it("groupBy merges tenantId into where, preserving by", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "groupBy",
          args: { by: ["status"], where: { projectId: "p1" } },
        })
      )
    );

    expect(args.where).toEqual({ projectId: "p1", tenantId: "tenant-a" });
    expect(args.by).toEqual(["status"]);
  });

  it("groupBy without a tenant context fails closed", async () => {
    await expect(
      run(makeParams({ action: "groupBy", args: { by: ["status"] } }))
    ).rejects.toMatchObject({ code: TENANT_CONTEXT_REQUIRED });
  });
});

describe("tenantFilter — cross-tenant isolation (negative: read)", () => {
  it("tenant A findMany targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findMany",
          args: { where: { id: "row-owned-by-B" } },
        })
      )
    );

    expect(args.where).toEqual({
      id: "row-owned-by-B",
      tenantId: "tenant-a",
    });
  });

  it("tenant A findFirst targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findFirst",
          args: { where: { id: "row-owned-by-B" } },
        })
      )
    );

    expect(args.where).toEqual({
      id: "row-owned-by-B",
      tenantId: "tenant-a",
    });
  });

  it("tenant A findUnique targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args, params } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findUnique",
          args: { where: { id: "row-owned-by-B" } },
        })
      )
    );

    expect(params.action).toBe("findFirst");
    expect(args.where).toEqual({
      AND: [{ id: "row-owned-by-B" }, { tenantId: "tenant-a" }],
    });
  });

  it("tenant A and tenant B never resolve to the same effective where", async () => {
    const a = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "findMany", args: { where: { id: "same-row" } } }))
    );
    const b = await withTenant("tenant-b", async () =>
      run(makeParams({ action: "findMany", args: { where: { id: "same-row" } } }))
    );

    expect(a.args.where).toEqual({ id: "same-row", tenantId: "tenant-a" });
    expect(b.args.where).toEqual({ id: "same-row", tenantId: "tenant-b" });
    expect(a.args.where).not.toEqual(b.args.where);
  });
});

describe("tenantFilter — cross-tenant isolation (negative: write)", () => {
  it("tenant A update targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "update",
          args: { where: { id: "row-owned-by-B" }, data: { title: "x" } },
        })
      )
    );

    expect(args.where).toEqual({
      id: "row-owned-by-B",
      tenantId: "tenant-a",
    });
  });

  it("tenant A delete targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "delete",
          args: { where: { id: "row-owned-by-B" } },
        })
      )
    );

    expect(args.where).toEqual({
      id: "row-owned-by-B",
      tenantId: "tenant-a",
    });
  });

  it("tenant A upsert targeting tenant B's row id is still scoped to tenant A", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "upsert",
          args: {
            where: { id: "row-owned-by-B" },
            update: { title: "updated" },
            create: { title: "created" },
          },
        })
      )
    );

    expect(args.where).toEqual({
      id: "row-owned-by-B",
      tenantId: "tenant-a",
    });
    expect(args.create).toEqual({ title: "created", tenantId: "tenant-a" });
  });

  it("tenant A updateMany overrides a caller-supplied tenantId filter with the context tenant", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "updateMany",
          args: { where: { tenantId: "tenant-b" }, data: { archived: true } },
        })
      )
    );

    expect(args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("tenant A deleteMany overrides a caller-supplied tenantId filter with the context tenant", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "deleteMany",
          args: { where: { tenantId: "tenant-b" } },
        })
      )
    );

    expect(args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("update overrides a caller-supplied tenantId in where with the context tenant", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "update",
          args: { where: { id: "x", tenantId: "tenant-b" }, data: {} },
        })
      )
    );

    expect(args.where).toEqual({ id: "x", tenantId: "tenant-a" });
  });

  it("create overrides a caller-supplied tenantId in data with the context tenant", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "create",
          args: { data: { title: "x", tenantId: "tenant-b" } },
        })
      )
    );

    expect(args.data).toEqual({ title: "x", tenantId: "tenant-a" });
  });
});

describe("tenantFilter — exempt models pass through unchanged", () => {
  const exemptModels: Prisma.ModelName[] = [
    "Profile",
    "Workspace",
    "Plan",
    "PlanLimit",
  ];
  const actions: Prisma.PrismaAction[] = [
    "findMany",
    "findFirst",
    "create",
    "update",
    "delete",
    "upsert",
    "count",
    "groupBy",
  ];

  for (const model of exemptModels) {
    for (const action of actions) {
      it(`passes ${model}.${action} through unchanged with a tenant context`, async () => {
        const params = makeParams({
          model,
          action,
          args: { where: { id: "x" }, data: { id: "x" } },
        });
        const { args, next } = await withTenant("tenant-a", async () =>
          run(params)
        );

        expect(args).toEqual({ where: { id: "x" }, data: { id: "x" } });
        expect(next).toHaveBeenCalled();
      });
    }
  }
});

describe("tenantFilter — bypass leaves params unchanged for every intercepted action", () => {
  const actions: Prisma.PrismaAction[] = [
    "findMany",
    "findFirst",
    "findUnique",
    "create",
    "update",
    "updateMany",
    "upsert",
    "delete",
    "deleteMany",
    "count",
    "aggregate",
    "groupBy",
  ];

  for (const action of actions) {
    it(`withTenantBypass leaves ${action} params unchanged`, async () => {
      const params = makeParams({
        action,
        args: { where: { id: "x" }, data: { title: "x" }, create: { title: "x" } },
      });
      const { args } = await withTenantBypass(async () => run(params));

      expect(args).toEqual({
        where: { id: "x" },
        data: { title: "x" },
        create: { title: "x" },
      });
    });
  }

  it("bypassTenantFilter=true leaves even a tenantId-bearing where untouched", async () => {
    const { args } = await run(
      makeParams({
        action: "findMany",
        args: { where: { tenantId: "tenant-b" }, bypassTenantFilter: true },
      })
    );

    expect(args).toEqual({ where: { tenantId: "tenant-b" } });
  });
});

describe("tenantFilter — passthrough and normalization edge cases", () => {
  it("passes through when params is undefined", async () => {
    const next = makeNext();
    await tenantFilter(
      undefined as unknown as Prisma.MiddlewareParams,
      next
    );
    expect(next).toHaveBeenCalledWith(undefined);
  });

  it("passes through when action is missing", async () => {
    const params = makeParams({ action: undefined });
    const { next } = await run(params);
    expect(next).toHaveBeenCalledWith(params);
  });

  it("normalizes non-object args and still injects tenantId", async () => {
    const params = makeParams({
      action: "findMany",
      args: "bogus" as unknown as MiddlewareParams["args"],
    });
    const { args, next } = await withTenant("tenant-a", async () => run(params));

    expect(next).toHaveBeenCalled();
    expect(args).toEqual({ where: { tenantId: "tenant-a" } });
  });

  it("merges tenantId when where is a non-object (falls back to empty base)", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findMany",
          args: {
            where: "bogus" as unknown as Prisma.TaskWhereInput,
          },
        })
      )
    );

    expect(args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("create with non-object data does not inject and does not crash", async () => {
    const params = makeParams({
      action: "create",
      args: { data: "bogus" } as unknown as MiddlewareParams["args"],
    });
    const { args } = await withTenant("tenant-a", async () => run(params));

    expect(args.data).toBe("bogus");
  });

  it("upsert with non-object create still scopes the where", async () => {
    const params = makeParams({
      action: "upsert",
      args: { where: { id: "x" }, create: "bogus", update: {} } as unknown as MiddlewareParams["args"],
    });
    const { args } = await withTenant("tenant-a", async () => run(params));

    expect(args.where).toEqual({ id: "x", tenantId: "tenant-a" });
    expect(args.create).toBe("bogus");
  });

  it("findUnique with no where still ANDs the tenant filter", async () => {
    const { args, params } = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "findUnique" }))
    );

    expect(params.action).toBe("findFirst");
    expect(args.where).toEqual({
      AND: [{}, { tenantId: "tenant-a" }],
    });
  });
});

describe("tenant context helpers", () => {
  it("getTenantId returns the active tenant inside withTenant", async () => {
    await withTenant("tenant-a", async () => {
      expect(getTenantId()).toBe("tenant-a");
    });
  });

  it("getTenantId returns null outside any context", () => {
    expect(getTenantId()).toBeNull();
  });

  it("getTenantContext exposes { tenantId, bypass: false } inside withTenant", async () => {
    await withTenant("tenant-a", async () => {
      expect(getTenantContext()).toEqual({ tenantId: "tenant-a", bypass: false });
    });
  });

  it("getTenantContext exposes { tenantId: null, bypass: true } inside withTenantBypass", async () => {
    await withTenantBypass(async () => {
      expect(getTenantContext()).toEqual({ tenantId: null, bypass: true });
    });
  });

  it("getTenantContext is undefined outside any context", () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it("context stays visible across awaits inside withTenant (deferred query execution)", async () => {
    await withTenant("tenant-a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getTenantId()).toBe("tenant-a");
    });
  });

  it("getTenantId returns null after the withTenant scope ends", async () => {
    await withTenant("tenant-a", async () => {
      expect(getTenantId()).toBe("tenant-a");
    });
    expect(getTenantId()).toBeNull();
  });

  it("throws TenantContextRequiredError with the model and action in the message", async () => {
    try {
      await run(makeParams({ action: "findMany" }));
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TenantContextRequiredError);
      expect((error as Error).message).toContain("Task");
      expect((error as Error).message).toContain("findMany");
    }
  });
});