import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { createDefaultColumns } from "../../../../src/lib/defaults";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/projects",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const where = await applyScopeFilter(user.id, ctx.tenantId, "project", {
      archived: false,
    });
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        area: true,
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json({ data: projects, error: null });
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/projects",
    method: "POST",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const body = await request.json();
  const { name, description, areaId } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  return withTenant(ctx.tenantId, async () => {
    const existing = await prisma.project.findFirst({ where: { name, archived: false, tenantId: ctx.tenantId! } });
    if (existing) {
      return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Project name already exists" } }, { status: 409 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        areaId: areaId || null,
        createdBy: user.id,
        tenantId: ctx.tenantId!,
      },
    });

    await createDefaultColumns(project.id, ctx.tenantId!);

    return withFeatureWarning(
      NextResponse.json({ data: project, error: null }, { status: 201 }),
      gate.warning
    );
  });
}
