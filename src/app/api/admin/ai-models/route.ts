import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../prisma/client";
import { listAIModelCatalog } from "@/lib/ai/model-catalog";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const user = await getUser();
  if (!user) return { response: NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 }) } as const;
  if (!(await getSuperAdminStatus(user.id))) {
    return { response: NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 }) } as const;
  }
  return { user } as const;
}

function validation(message: string) {
  return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
}

function readInteger(value: unknown, name: string, minimum = 0): number | null {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) return null;
  return value as number;
}

function readUsdPerMillion(value: unknown, name: string): number | null {
  const normalized = typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  if (typeof normalized !== "number" || !Number.isFinite(normalized) || normalized < 0) return null;
  const micros = Math.round(normalized * 1_000_000);
  return Number.isSafeInteger(micros) ? micros : null;
}
export async function GET() {
  const gate = await requireSuperAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({ data: await listAIModelCatalog(), error: null });
}

export async function POST(request: Request) {
  const gate = await requireSuperAdmin();
  if ("response" in gate) return gate.response;
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return validation("Request body must be an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return validation("Request body must be valid JSON");
  }

  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const ownershipMode = body.ownershipMode;
  if (!provider || !model) return validation("provider and model are required");
  if (ownershipMode !== "managed" && ownershipMode !== "byok") return validation("ownershipMode must be managed or byok");
  const inputCostMicros = readUsdPerMillion(body.inputCostPerMillion, "inputCostPerMillion");
  const outputCostMicros = readUsdPerMillion(body.outputCostPerMillion, "outputCostPerMillion");
  const imageCostMicros = readUsdPerMillion(body.imageCostPerMillion ?? 0, "imageCostPerMillion");
  const creditCostPerCycle = readInteger(body.creditCostPerCycle, "creditCostPerCycle");
  const maxOutputTokens = readInteger(body.maxOutputTokens, "maxOutputTokens", 1);
  if ([inputCostMicros, outputCostMicros, imageCostMicros, creditCostPerCycle, maxOutputTokens].some((value) => value === null)) {
    return validation("Token costs must be valid non-negative USD amounts per million tokens");
  }
  if (typeof body.vision !== "boolean" || typeof body.streaming !== "boolean") return validation("vision and streaming must be booleans");

  const latest = await prisma.aiModelCatalogEntry.findFirst({ where: { provider, model }, orderBy: { version: "desc" }, select: { version: true } });
  const entry = await prisma.aiModelCatalogEntry.create({
    data: {
      provider,
      model,
      ownershipMode,
      vision: body.vision,
      streaming: body.streaming,
      inputCostMicros: inputCostMicros!,
      outputCostMicros: outputCostMicros!,
      imageCostMicros: imageCostMicros!,
      creditCostPerCycle: creditCostPerCycle!,
      maxOutputTokens: maxOutputTokens!,
      version: (latest?.version ?? 0) + 1,
      createdBy: gate.user.id,
    },
  });
  return NextResponse.json({ data: entry, error: null }, { status: 201 });
}
