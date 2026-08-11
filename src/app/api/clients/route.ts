import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.clients.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const parsedPage = parseInt(searchParams.get("page") || "", 10);
  const page = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
  const parsedPageSize = parseInt(searchParams.get("pageSize") || "", 10);
  const pageSize = Number.isNaN(parsedPageSize)
    ? 25
    : Math.min(50, Math.max(1, parsedPageSize));
  const activeParam = searchParams.get("active");
  const activeFilter: "active" | "inactive" | "all" =
    activeParam === "true"
      ? "active"
      : activeParam === "false"
        ? "inactive"
        : activeParam === "all"
          ? "all"
          : "active";

  const where = {
    ...(activeFilter === "active"
      ? { active: true }
      : activeFilter === "inactive"
        ? { active: false }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { cpfCnpj: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return withTenant(ctx.tenantId, async () => {
    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { contracts: true } } },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      error: null,
    });
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.clients.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { name, legalName, cpfCnpj, email, phone, notes } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      { status: 400 }
    );
  }

  try {
    const client = await withTenant(ctx.tenantId, () =>
      prisma.client.create({
        data: {
          name: name.trim(),
          legalName: legalName || null,
          cpfCnpj: cpfCnpj || null,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          tenantId: ctx.tenantId!,
        },
      })
    );
    return NextResponse.json({ data: client, error: null }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    throw error;
  }
}
