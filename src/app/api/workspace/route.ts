import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/authz/authz";
import { prisma, withTenant } from "../../../../prisma/client";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function forbidden() {
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
      },
    },
    { status: 403 }
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Workspace not found" } },
    { status: 404 }
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 }
  );
}

function conflict(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "CONFLICT", message } },
    { status: 409 }
  );
}

async function getWorkspaceForUser(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          companyName: true,
          status: true,
          gracePeriodEndsAt: true,
          plan: {
            select: {
              id: true,
              name: true,
              allowedModules: true,
              planLimits: true,
            },
          },
        },
      },
    },
  });
  return profile?.tenant ?? null;
}

async function computeUsage(tenantId: string) {
  return withTenant(tenantId, async () => {
    const [users, tasks, projects, contracts] = await Promise.all([
      prisma.profile.count({ where: { tenantId } }),
      prisma.task.count({ where: { tenantId } }),
      prisma.project.count({ where: { tenantId } }),
      prisma.contract.count({ where: { tenantId } }),
    ]);
    return { users, tasks, projects, contracts };
  });
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return notFound();

  const usage = await computeUsage(workspace.id);
  const allowedModules = (workspace.plan?.allowedModules as string[]) ?? [];
  const planLimits = workspace.plan?.planLimits ?? [];

  const limits: Record<string, { limit: number; remaining: number; behavior: string }> = {};
  for (const planLimit of planLimits) {
    const used = (usage as Record<string, number>)[planLimit.resource] ?? 0;
    limits[planLimit.resource] = {
      limit: planLimit.limit,
      remaining: planLimit.limit - used,
      behavior: planLimit.behavior,
    };
  }

  return NextResponse.json({
    data: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      companyName: workspace.companyName,
      status: workspace.status,
      gracePeriodEndsAt: workspace.gracePeriodEndsAt,
      plan: workspace.plan
        ? {
            id: workspace.plan.id,
            name: workspace.plan.name,
            allowedModules,
          }
        : null,
      features: {
        allowedModules,
        limits,
        usage,
      },
    },
    error: null,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  const effective = await getEffectivePermissions(user.id);
  if (!effective.isAdmin) return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("Invalid request body");
  }

  const data: {
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    companyName?: string | null;
    defaultRoleId?: string | null;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return badRequest("Workspace name must be a non-empty string");
    }
    data.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || !SLUG_PATTERN.test(body.slug)) {
      return badRequest("Slug must use lowercase letters, numbers and hyphens");
    }
    data.slug = body.slug;
  }
  if (body.logoUrl !== undefined) {
    if (body.logoUrl !== null && typeof body.logoUrl !== "string") {
      return badRequest("Logo URL must be a string");
    }
    data.logoUrl = body.logoUrl ?? null;
  }
  if (body.companyName !== undefined) {
    if (body.companyName !== null && typeof body.companyName !== "string") {
      return badRequest("Company name must be a string");
    }
    data.companyName = body.companyName ?? null;
  }
  if (body.defaultRoleId !== undefined) {
    if (body.defaultRoleId !== null && typeof body.defaultRoleId !== "string") {
      return badRequest("Default role must be a role id");
    }
    data.defaultRoleId = body.defaultRoleId ?? null;
  }

  if (Object.keys(data).length === 0) {
    return badRequest("Nothing to update");
  }

  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return notFound();

  const defaultRoleId = data.defaultRoleId ?? null;
  if (defaultRoleId) {
    const role = await withTenant(workspace.id, () =>
      prisma.role.findFirst({
        where: { id: defaultRoleId, tenantId: workspace.id },
      })
    );
    if (!role) {
      return badRequest("Default role must belong to this workspace");
    }
  }

  if (data.slug && data.slug !== workspace.slug) {
    const existing = await prisma.workspace.findFirst({
      where: { slug: data.slug, NOT: { id: workspace.id } },
    });
    if (existing) {
      return conflict("A workspace with this slug already exists");
    }
  }

  try {
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data,
    });
    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return conflict("A workspace with this slug already exists");
    }
    console.error("Workspace update failed:", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}