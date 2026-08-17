import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { isStripePriceId } from "@/lib/stripe-price-id";
import { ALL_MODULES } from "@/lib/module-gating";
import { prisma } from "../../../../../prisma/client";

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

export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: plans.map((plan) => ({
      ...plan,
      allowedModules: (plan.allowedModules as string[]) ?? [],
    })),
    error: null,
  });
}

export async function POST(request: Request) {
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

  if (typeof name !== "string" || name.trim() === "") {
    return validationErrorResponse("name is required and must be a non-empty string");
  }
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
  if (
    stripePriceId !== undefined &&
    stripePriceId !== null &&
    typeof stripePriceId !== "string"
  ) {
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
  if (isDefault !== undefined && typeof isDefault !== "boolean") {
    return validationErrorResponse("isDefault must be a boolean");
  }

  const data = {
    name: name.trim(),
    stripePriceId:
      typeof stripePriceId === "string" && stripePriceId !== ""
        ? stripePriceId
        : null,
    allowedModules: allowedModules as string[],
    isDefault: isDefault ?? false,
    isActive: true,
  };

  if (data.isDefault) {
    const [, plan] = await prisma.$transaction([
      prisma.plan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      prisma.plan.create({ data }),
    ]);
    return NextResponse.json({ data: plan, error: null }, { status: 201 });
  }

  const plan = await prisma.plan.create({ data });
  return NextResponse.json({ data: plan, error: null }, { status: 201 });
}