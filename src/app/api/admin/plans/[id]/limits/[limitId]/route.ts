import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../../../prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_RESOURCES = ["users", "tasks", "projects", "contracts"] as const;
const ALLOWED_BEHAVIORS = ["hard", "warning"] as const;

type LimitResource = (typeof ALLOWED_RESOURCES)[number];
type LimitBehavior = (typeof ALLOWED_BEHAVIORS)[number];

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
    { data: null, error: { code: "NOT_FOUND", message: "Plan limit not found" } },
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
  props: { params: Promise<{ id: string; limitId: string }> }
) {
  const params = await props.params;
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const planLimit = await prisma.planLimit.findFirst({
    where: { id: params.limitId, planId: params.id },
  });
  if (!planLimit) return notFoundResponse();

  return NextResponse.json({ data: planLimit, error: null });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; limitId: string }> }
) {
  const params = await props.params;
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

  const { resource, limit, behavior } = body as Record<string, unknown>;

  const data: Prisma.PlanLimitUpdateInput = {};

  if (resource !== undefined) {
    if (
      typeof resource !== "string" ||
      !ALLOWED_RESOURCES.includes(resource as LimitResource)
    ) {
      return validationErrorResponse(
        "resource must be one of: users, tasks, projects, contracts"
      );
    }
    data.resource = resource as LimitResource;
  }
  if (limit !== undefined) {
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0) {
      return validationErrorResponse("limit must be a non-negative integer");
    }
    data.limit = limit;
  }
  if (behavior !== undefined) {
    if (
      typeof behavior !== "string" ||
      !ALLOWED_BEHAVIORS.includes(behavior as LimitBehavior)
    ) {
      return validationErrorResponse("behavior must be one of: hard, warning");
    }
    data.behavior = behavior as LimitBehavior;
  }

  const existing = await prisma.planLimit.findFirst({
    where: { id: params.limitId, planId: params.id },
  });
  if (!existing) return notFoundResponse();

  const planLimit = await prisma.planLimit.update({
    where: { id: params.limitId },
    data,
  });

  return NextResponse.json({ data: planLimit, error: null });
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; limitId: string }> }
) {
  const params = await props.params;
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const existing = await prisma.planLimit.findFirst({
    where: { id: params.limitId, planId: params.id },
  });
  if (!existing) return notFoundResponse();

  const planLimit = await prisma.planLimit.delete({
    where: { id: params.limitId },
  });

  return NextResponse.json({ data: planLimit, error: null });
}