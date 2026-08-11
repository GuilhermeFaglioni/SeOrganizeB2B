import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { countWorkspaceUsage } from "@/lib/features";
import { prisma } from "../../../../../../prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["active", "grace_period", "cancelled"] as const;
type TenantStatus = (typeof VALID_STATUSES)[number];
const GRACE_EXTENSION_MS = 3 * 24 * 60 * 60 * 1000;

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
        message: "Only super-admins can manage tenants",
      },
    },
    { status: 403 }
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Tenant not found" } },
    { status: 404 }
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 }
  );
}

async function checkSuperAdmin(userId: string): Promise<boolean> {
  return getSuperAdminStatus(userId);
}

async function findTenant(id: string) {
  return prisma.workspace.findFirst({
    where: { id, deletedAt: null },
    include: { plan: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return unauthorized();

  const isSuperAdmin = await checkSuperAdmin(user.id);
  if (!isSuperAdmin) return forbidden();

  const workspace = await findTenant(params.id);
  if (!workspace) return notFound();

  const profiles = await prisma.profile.findMany({
    where: { tenantId: workspace.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const usage = await countWorkspaceUsage(workspace.id);

  return NextResponse.json({
    data: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      companyName: workspace.companyName,
      status: workspace.status,
      gracePeriodEndsAt: workspace.gracePeriodEndsAt,
      cancelledAt: workspace.cancelledAt,
      deletedAt: workspace.deletedAt,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      plan: workspace.plan
        ? {
            id: workspace.plan.id,
            name: workspace.plan.name,
            isActive: workspace.plan.isActive,
          }
        : null,
      profiles,
      usage,
    },
    error: null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return unauthorized();

  const isSuperAdmin = await checkSuperAdmin(user.id);
  if (!isSuperAdmin) return forbidden();

  const workspace = await findTenant(params.id);
  if (!workspace) return notFound();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("Invalid request body");
  }

  const data: {
    status?: TenantStatus;
    planId?: string;
    gracePeriodEndsAt?: Date;
  } = {};

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as TenantStatus)) {
      return badRequest("Status must be one of: active, grace_period, cancelled");
    }
    data.status = body.status as TenantStatus;
  }

  if (body.planId !== undefined) {
    if (typeof body.planId !== "string" || !body.planId.trim()) {
      return badRequest("Plan id must be a non-empty string");
    }
    const plan = await prisma.plan.findUnique({
      where: { id: body.planId },
      select: { id: true, isActive: true },
    });
    if (!plan || !plan.isActive) {
      return badRequest("Plan must exist and be active");
    }
    data.planId = body.planId;
  }

  if (body.extendGracePeriod !== undefined) {
    if (typeof body.extendGracePeriod !== "boolean") {
      return badRequest("extendGracePeriod must be a boolean");
    }
    if (body.extendGracePeriod) {
      const base = workspace.gracePeriodEndsAt ?? new Date();
      data.gracePeriodEndsAt = new Date(base.getTime() + GRACE_EXTENSION_MS);
    }
  }

  if (Object.keys(data).length === 0) {
    return badRequest("Nothing to update");
  }

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data,
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return unauthorized();

  const isSuperAdmin = await checkSuperAdmin(user.id);
  if (!isSuperAdmin) return forbidden();

  const workspace = await findTenant(params.id);
  if (!workspace) return notFound();

  const now = new Date();
  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      deletedAt: now,
      ...(workspace.status === "active"
        ? { status: "cancelled", cancelledAt: now }
        : {}),
    },
  });

  return NextResponse.json({ data: updated, error: null });
}