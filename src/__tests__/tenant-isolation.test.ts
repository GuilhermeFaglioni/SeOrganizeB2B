import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  tenantFilter,
  withTenant,
  withTenantBypass,
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

describe("tenantFilter — reads inject tenantId into WHERE", () => {
  it("findMany merges tenantId into where, preserving existing filters", async () => {
    const { args, params } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findMany",
          args: { where: { projectId: "proj-1" } },
        })
      )
    );

    expect(args.where).toEqual({ projectId: "proj-1", tenantId: "tenant-a" });
    expect(params.action).toBe("findMany");
  });

  it("findFirst merges tenantId into an AND-shaped where", async () => {
    const { args } = await withTenant("tenant-b", async () =>
      run(
        makeParams({
          action: "findFirst",
          args: { where: { AND: [{ columnId: "col-1" }] } },
        })
      )
    );

    expect(args.where).toEqual({
      AND: [{ columnId: "col-1" }],
      tenantId: "tenant-b",
    });
  });

  it("findMany with no where still gets tenantId", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "findMany" }))
    );

    expect(args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("count and aggregate merge tenantId into where", async () => {
    const countResult = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "count", args: { where: { archived: false } } }))
    );
    expect(countResult.args.where).toEqual({
      archived: false,
      tenantId: "tenant-a",
    });

    const aggResult = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "aggregate", args: { where: {} } }))
    );
    expect(aggResult.args.where).toEqual({ tenantId: "tenant-a" });
  });

  it("findUnique transforms to a tenant-scoped findFirst with AND-wrapped where", async () => {
    const { args, params } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "findUnique",
          args: { where: { id: "task-1" }, select: { id: true } },
        })
      )
    );

    expect(params.action).toBe("findFirst");
    expect(args.where).toEqual({
      AND: [{ id: "task-1" }, { tenantId: "tenant-a" }],
    });
    expect(args.select).toEqual({ id: true });
  });
});

describe("tenantFilter — writes inject tenantId", () => {
  it("create injects tenantId into data", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "create",
          args: { data: { title: "New task" } },
        })
      )
    );

    expect(args.data).toEqual({ title: "New task", tenantId: "tenant-a" });
  });

  it("create does not override an explicit tenantId with a different one — context wins", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "create",
          args: { data: { title: "x", tenantId: "tenant-b" } },
        })
      )
    );

    expect(args.data.tenantId).toBe("tenant-a");
  });

  it("update merges tenantId into where", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "update",
          args: { where: { id: "task-1" }, data: { title: "renamed" } },
        })
      )
    );

    expect(args.where).toEqual({ id: "task-1", tenantId: "tenant-a" });
  });

  it("delete merges tenantId into where", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "delete",
          args: { where: { id: "task-1" } },
        })
      )
    );

    expect(args.where).toEqual({ id: "task-1", tenantId: "tenant-a" });
  });

  it("updateMany and deleteMany merge tenantId into where", async () => {
    const updateMany = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "updateMany",
          args: { where: { projectId: "p1" }, data: { archived: true } },
        })
      )
    );
    expect(updateMany.args.where).toEqual({
      projectId: "p1",
      tenantId: "tenant-a",
    });

    const deleteMany = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "deleteMany",
          args: { where: { projectId: "p1" } },
        })
      )
    );
    expect(deleteMany.args.where).toEqual({
      projectId: "p1",
      tenantId: "tenant-a",
    });
  });

  it("upsert merges tenantId into where and injects into create", async () => {
    const { args } = await withTenant("tenant-a", async () =>
      run(
        makeParams({
          action: "upsert",
          args: {
            where: { id: "task-1" },
            update: { title: "updated" },
            create: { title: "created" },
          },
        })
      )
    );

    expect(args.where).toEqual({ id: "task-1", tenantId: "tenant-a" });
    expect(args.create).toEqual({ title: "created", tenantId: "tenant-a" });
  });
});

describe("tenantFilter — exempt models are never touched", () => {
  const exemptModels: Prisma.ModelName[] = [
    "Profile",
    "Workspace",
    "Plan",
    "PlanLimit",
    "Invite",
  ];

  for (const model of exemptModels) {
    it(`skips ${model} for findMany`, async () => {
      const { args, next } = await withTenant("tenant-a", async () =>
        run(makeParams({ model, action: "findMany", args: { where: { id: "x" } } }))
      );

      expect(args).toEqual({ where: { id: "x" } });
      expect(next).toHaveBeenCalled();
    });

    it(`skips ${model} for create`, async () => {
      const { args } = await withTenant("tenant-a", async () =>
        run(makeParams({ model, action: "create", args: { data: { id: "x" } } }))
      );

      expect(args).toEqual({ data: { id: "x" } });
    });

    it(`skips ${model} for update without a tenant context (no throw)`, async () => {
      const { args } = await run(
        makeParams({ model, action: "update", args: { where: { id: "x" }, data: {} } })
      );

      expect(args).toEqual({ where: { id: "x" }, data: {} });
    });
  }
});

describe("tenantFilter — no context fails closed", () => {
  const scopedActions: Prisma.PrismaAction[] = [
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
  ];

  for (const action of scopedActions) {
    it(`throws ${TENANT_CONTEXT_REQUIRED} for Task.${action} without a context`, async () => {
      const params = makeParams({ action });
      await expect(run(params)).rejects.toThrow(TenantContextRequiredError);
      await expect(run(params)).rejects.toMatchObject({
        code: TENANT_CONTEXT_REQUIRED,
      });
    });
  }

  it("throws for other tenant-scoped models without a context", async () => {
    await expect(
      run(makeParams({ model: "Contract", action: "findMany" }))
    ).rejects.toMatchObject({ code: TENANT_CONTEXT_REQUIRED });
  });

  it("does NOT throw for exempt models without a context", async () => {
    await expect(
      run(makeParams({ model: "Workspace", action: "findMany" }))
    ).resolves.toBeDefined();
  });
});

describe("tenantFilter — bypass", () => {
  it("withTenantBypass skips filtering for tenant-scoped models", async () => {
    const { args, next } = await withTenantBypass(async () =>
      run(makeParams({ action: "findMany", args: { where: { id: "x" } } }))
    );

    expect(args).toEqual({ where: { id: "x" } });
    expect(next).toHaveBeenCalled();
  });

  it("withTenantBypass skips writes for tenant-scoped models", async () => {
    const { args } = await withTenantBypass(async () =>
      run(makeParams({ action: "create", args: { data: { title: "x" } } }))
    );

    expect(args).toEqual({ data: { title: "x" } });
  });

  it("args.bypassTenantFilter = true opts a single call out and is stripped", async () => {
    const { args } = await run(
      makeParams({
        action: "findMany",
        args: { where: { id: "x" }, bypassTenantFilter: true },
      })
    );

    expect(args).toEqual({ where: { id: "x" } });
    expect(args.bypassTenantFilter).toBeUndefined();
  });

  it("args._skipTenantFilter = true opts a single call out and is stripped", async () => {
    const { args } = await run(
      makeParams({
        action: "findMany",
        args: { where: { id: "x" }, _skipTenantFilter: true },
      })
    );

    expect(args).toEqual({ where: { id: "x" } });
    expect(args._skipTenantFilter).toBeUndefined();
  });

  it("bypass flags work on writes and are stripped from data", async () => {
    const { args } = await run(
      makeParams({
        action: "create",
        args: { data: { title: "x" }, bypassTenantFilter: true },
      })
    );

    expect(args).toEqual({ data: { title: "x" } });
  });
});

describe("tenantFilter — cross-tenant isolation", () => {
  it("injects the requesting tenant's id", async () => {
    const tenantA = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "findMany" }))
    );
    const tenantB = await withTenant("tenant-b", async () =>
      run(makeParams({ action: "findMany" }))
    );

    expect(tenantA.args.where).toEqual({ tenantId: "tenant-a" });
    expect(tenantB.args.where).toEqual({ tenantId: "tenant-b" });
    expect(tenantA.args.where).not.toEqual(tenantB.args.where);
  });
});

describe("tenantFilter — passthrough and edge cases", () => {
  it("returns the result of next() unchanged", async () => {
    const { result } = await withTenant("tenant-a", async () =>
      run(makeParams({ action: "findMany" }))
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("does not intercept actions outside the set (createMany passes through without a context)", async () => {
    const params = makeParams({
      action: "createMany",
      args: { data: [{ title: "a" }] },
    });
    const { args, next } = await run(params);

    expect(args).toEqual({ data: [{ title: "a" }] });
    expect(next).toHaveBeenCalled();
  });

  it("does not intercept executeRaw/queryRaw", async () => {
    const { args, next } = await run(
      makeParams({
        action: "executeRaw",
        args: { query: "SELECT 1" },
      })
    );
    expect(next).toHaveBeenCalled();
    expect(args).toEqual({ query: "SELECT 1" });
  });

  it("passes through when model is missing", async () => {
    const params = makeParams({ model: undefined });
    const { next } = await run(params);
    expect(next).toHaveBeenCalledWith(params);
  });

  it("normalizes missing args and still filters (no cross-tenant leak)", async () => {
    const params = makeParams({ action: "findMany", args: undefined });
    const { args, next } = await withTenant("tenant-a", async () => run(params));

    expect(next).toHaveBeenCalled();
    expect(args).toEqual({ where: { tenantId: "tenant-a" } });
  });

  it("throws TENANT_CONTEXT_REQUIRED for argless deleteMany without a context", async () => {
    const params = makeParams({ action: "deleteMany", args: undefined });
    await expect(run(params)).rejects.toMatchObject({
      code: TENANT_CONTEXT_REQUIRED,
    });
  });

  it("invokes next() with the mutated params object", async () => {
    const params = makeParams({ action: "findMany" });
    const { next } = await withTenant("tenant-a", async () => run(params));
    expect(next.mock.calls[0][0]).toBe(params);
  });
});

describe("withTenant / withTenantBypass context helpers", () => {
  it("withTenant returns the wrapped function's value", async () => {
    const value = await withTenant("tenant-a", async () => "done");
    expect(value).toBe("done");
  });

  it("withTenantBypass returns the wrapped function's value", async () => {
    const value = await withTenantBypass(async () => 42);
    expect(value).toBe(42);
  });

  it("does not leak context between sequential calls", async () => {
    const results: unknown[] = [];
    await withTenant("tenant-a", async () => {
      results.push(
        (await run(makeParams({ action: "findMany" }))).args.where
      );
    });
    await expect(
      run(makeParams({ action: "findMany" }))
    ).rejects.toMatchObject({ code: TENANT_CONTEXT_REQUIRED });
    expect(results).toEqual([{ tenantId: "tenant-a" }]);
  });
});
