import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { isStripePriceId } from "@/lib/stripe-price-id";
import { ALL_MODULES } from "@/lib/module-gating";
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

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const plan = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!plan) return notFoundResponse();

  return NextResponse.json({ data: plan, error: null });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
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

  const { name, stripePriceId, allowedModules, isDefault, isActive } =
    body as Record<string, unknown>;

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
    if (
      typeof stripePriceId === "string" &&
      stripePriceId !== "" &&
      !isStripePriceId(stripePriceId)
    ) {
      return validationErrorResponse(
        "stripePriceId must be a Stripe Price ID (price_…), not a Product ID (prod_…)"
      );
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
    const unknownModules = (allowedModules as string[]).filter(
      (module) => !ALL_MODULES.includes(module as (typeof ALL_MODULES)[number])
    );
    if (unknownModules.length > 0) {
      return validationErrorResponse(
        `allowedModules contains unknown modules: ${unknownModules.join(", ")}`
      );
    }
    data.allowedModules = allowedModules as string[];
  }
  if (isDefault !== undefined) {
    if (typeof isDefault !== "boolean") {
      return validationErrorResponse("isDefault must be a boolean");
    }
    data.isDefault = isDefault;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return validationErrorResponse("isActive must be a boolean");
    }
    data.isActive = isActive;
  }

  if (Object.keys(data).length === 0) {
    return validationErrorResponse("Nothing to update");
  }

  const existing = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!existing) return notFoundResponse();

  if (existing.isInternal && data.isActive === false) {
    return validationErrorResponse("Internal plans cannot be deactivated");
  }
  if (data.isActive === false && data.isDefault === true) {
    return validationErrorResponse(
      "An inactive plan cannot be set as default"
    );
  }
  if (
    data.isDefault === true &&
    existing.isActive === false &&
    data.isActive !== true
  ) {
    return validationErrorResponse("An inactive plan cannot be set as default");
  }
  if (data.isActive === false && existing.isDefault && data.isDefault === undefined) {
    data.isDefault = false;
  }

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

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const existing = await prisma.plan.findUnique({ where: { id: params.id } });
  if (!existing) return notFoundResponse();

  if (existing.isInternal) {
    return validationErrorResponse("Internal plans cannot be deleted");
  }

  const plan = await prisma.plan.update({
    where: { id: params.id },
    data: existing.isDefault
      ? { isActive: false, isDefault: false }
      : { isActive: false },
  });

  return NextResponse.json({ data: plan, error: null });
}