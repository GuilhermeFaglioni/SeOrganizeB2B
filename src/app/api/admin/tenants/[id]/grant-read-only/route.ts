import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../../prisma/client";
import {
  createReadOnlyAccess,
  ReadOnlyAccessValidationError,
} from "@/lib/admin/read-only-service";

export const dynamic = "force-dynamic";

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return unauthorized();

  const isSuperAdmin = await getSuperAdminStatus(user.id);
  if (!isSuperAdmin) return forbidden();

  const workspace = await prisma.workspace.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) return notFound();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("Invalid request body");
  }

  try {
    const result = await createReadOnlyAccess({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      email: typeof body.email === "string" ? body.email : "",
      expiresInDays:
        typeof body.expiresIn === "number" ? body.expiresIn : undefined,
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof ReadOnlyAccessValidationError) {
      return badRequest(error.message);
    }
    console.error("Failed to grant read-only access:", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
