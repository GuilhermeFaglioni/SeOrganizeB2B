import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../prisma/client";
import { listAICreditPackages } from "@/lib/ai/credit-packages";

async function gate() { const user = await getUser(); if (!user) return { response: NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 }) } as const; if (!(await getSuperAdminStatus(user.id))) return { response: NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 }) } as const; return { user } as const; }
function validInteger(value: unknown, nullable = false) { return (nullable && value === null) || (typeof value === "number" && Number.isSafeInteger(value) && value > 0); }

export async function GET() { const checked = await gate(); if ("response" in checked) return checked.response; return NextResponse.json({ data: await listAICreditPackages(), error: null }); }
export async function POST(request: Request) {
  const checked = await gate(); if ("response" in checked) return checked.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim() || typeof body.stripePriceId !== "string" || !validInteger(body.priceCents) || !validInteger(body.creditQuantity) || !validInteger(body.maxPurchasesPerMonth, true) || !validInteger(body.maxCreditsPerMonth, true)) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Invalid package configuration" } }, { status: 400 });
  const entry = await prisma.aiCreditPackage.create({ data: { name: body.name.trim(), stripePriceId: body.stripePriceId.trim(), priceCents: body.priceCents as number, creditQuantity: body.creditQuantity as number, maxPurchasesPerMonth: body.maxPurchasesPerMonth as number | null ?? null, maxCreditsPerMonth: body.maxCreditsPerMonth as number | null ?? null } });
  return NextResponse.json({ data: entry, error: null }, { status: 201 });
}
