import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../prisma/client";

export const dynamic = "force-dynamic";

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: "FORBIDDEN", message: "Forbidden" } },
    { status: 403 }
  );
}

function validationErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 }
  );
}

function notFoundResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Plan not found" } },
    { status: 404 }
  );
}

type GateResult =
  | { ok: true; user: { id: string } }
  | { ok: false; response: NextResponse };

async function requireSuperAdmin(): Promise<GateResult> {
  const user = await getUser();
  if (!user) return { ok: false, response: unauthorizedResponse() };
  const isSuperAdmin = await getSuperAdminStatus(user.id);
  if (!isSuperAdmin) return { ok: false, response: forbiddenResponse() };
  return { ok: true, user };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const plan = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!plan) return notFoundResponse();

  return NextResponse.json({ data: plan, error: null });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return validationErrorResponse("Request body must be an object");
  }

  const { name, stripePriceId, allowedModules, isDefault } = body as Record<
    string,
    unknown
  >;

  const data: Prisma.PlanUpdateInput = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return validationErrorResponse("name must be a non-empty string");
    }
    data.name = name.trim();
  }
  if (stripePriceId !== undefined) {
    if (stripePriceId !== null && typeof stripePriceId !== "string") {
      return validationErrorResponse("stripePriceId must be a string");
    }
    data.stripePriceId =
      typeof stripePriceId === "string" && stripePriceId !== ""
        ? stripePriceId
        : null;
  }
  if (allowedModules !== undefined) {
    if (
      !Array.isArray(allowedModules) ||
      allowedModules.some((module) => typeof module !== "string")
    ) {
      return validationErrorResponse("allowedModules must be an array of strings");
    }
    data.allowedModules = allowedModules as string[];
  }
  if (isDefault !== undefined) {
    if (typeof isDefault !== "boolean") {
      return validationErrorResponse("isDefault must be a boolean");
    }
    data.isDefault = isDefault;
  }

  const existing = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!existing) return notFoundResponse();

  if (data.isDefault === true) {
    const [, plan] = await prisma.$transaction([
      prisma.plan.updateMany({
        where: { isDefault: true, id: { not: params.id } },
        data: { isDefault: false },
      }),
      prisma.plan.update({ where: { id: params.id }, data }),
    ]);
    return NextResponse.json({ data: plan, error: null });
  }

  const plan = await prisma.plan.update({ where: { id: params.id }, data });
  return NextResponse.json({ data: plan, error: null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const existing = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!existing) return notFoundResponse();

  const plan = await prisma.plan.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ data: plan, error: null });
}