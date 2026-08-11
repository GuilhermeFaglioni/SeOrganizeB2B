import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "documents.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/documents/[id]",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const doc = await withTenant(ctx.tenantId, () =>
    prisma.document.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true } },
      },
    })
  );

  if (!doc) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: doc, error: null });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "documents.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/documents/[id]",
    method: "PATCH",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, projectId } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (projectId !== undefined) data.projectId = projectId;

    const updated = await prisma.document.update({
      where: { id: params.id },
      data,
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    return withFeatureWarning(
      NextResponse.json({ data: updated, error: null }),
      gate.warning
    );
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "documents.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/documents/[id]",
    method: "DELETE",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
    }

    await prisma.document.delete({ where: { id: params.id } });

    return withFeatureWarning(
      NextResponse.json({ data: { id: params.id }, error: null }),
      gate.warning
    );
  });
}
