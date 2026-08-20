import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../../prisma/client";

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

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const plan = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!plan) return notFoundResponse();

  const limits = await prisma.planLimit.findMany({
    where: { planId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: limits, error: null });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
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

  if (
    typeof resource !== "string" ||
    !ALLOWED_RESOURCES.includes(resource as LimitResource)
  ) {
    return validationErrorResponse(
      "resource must be one of: users, tasks, projects, contracts"
    );
  }
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0) {
    return validationErrorResponse("limit must be a non-negative integer");
  }
  if (
    typeof behavior !== "string" ||
    !ALLOWED_BEHAVIORS.includes(behavior as LimitBehavior)
  ) {
    return validationErrorResponse("behavior must be one of: hard, warning");
  }

  const plan = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!plan) return notFoundResponse();

  const planLimit = await prisma.planLimit.create({
    data: {
      planId: params.id,
      resource: resource as LimitResource,
      limit,
      behavior: behavior as LimitBehavior,
    },
  });

  return NextResponse.json({ data: planLimit, error: null }, { status: 201 });
}