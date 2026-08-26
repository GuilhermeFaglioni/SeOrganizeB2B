import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import {
  AICreditAdminError,
  getAICreditBalance,
  getAICreditLedgerHistory,
  applyManualAICreditOperation,
  AI_CREDIT_POOLS,
  type ManualAICreditOperation,
} from "@/lib/ai/credit-ledger";
import { withTenantBypass, prisma } from "../../../../../../../prisma/client";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json({ data, error: null }, { status });
const error = (code: string, message: string, status: number) =>
  NextResponse.json({ data: null, error: { code, message } }, { status });

async function gate(id: string) {
  const user = await getUser();
  if (!user) return { response: error("AUTH_ERROR", "Unauthorized", 401) } as const;
  if (!(await getSuperAdminStatus(user.id))) return { response: error("FORBIDDEN", "Only super-admins can manage credits", 403) } as const;
  const tenant = await withTenantBypass(() => prisma.workspace.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
  if (!tenant) return { response: error("NOT_FOUND", "Tenant not found", 404) } as const;
  return { user } as const;
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const checked = await gate(id);
  if ("response" in checked) return checked.response;
  const [balance, history] = await Promise.all([getAICreditBalance(id), getAICreditLedgerHistory(id)]);
  return json({ balance, history });
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const checked = await gate(id);
  if ("response" in checked) return checked.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.operation !== "string" || typeof body.quantity !== "number" || typeof body.reason !== "string") {
    return error("VALIDATION_ERROR", "operation, quantity and reason are required", 400);
  }
  if (!(AI_CREDIT_POOLS as readonly string[]).includes(String(body.pool ?? "promotional"))) {
    return error("VALIDATION_ERROR", "Unknown credit pool", 400);
  }
  try {
    const operation = body.operation as ManualAICreditOperation;
    if (!["grant", "revoke", "adjustment"].includes(operation)) throw new AICreditAdminError("VALIDATION_ERROR", "Unknown credit operation");
    const expiresAt = body.expiresAt === undefined || body.expiresAt === null ? null : new Date(String(body.expiresAt));
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new AICreditAdminError("VALIDATION_ERROR", "Invalid expiration");
    const result = await applyManualAICreditOperation({
      tenantId: id, actorId: checked.user.id, operation, pool: String(body.pool ?? "promotional") as typeof AI_CREDIT_POOLS[number],
      quantity: body.quantity, reason: body.reason, campaign: typeof body.campaign === "string" ? body.campaign : undefined,
      expiresAt, operationKey: typeof body.operationKey === "string" ? body.operationKey : undefined,
    });
    return json(result, 201);
  } catch (caught) {
    if (caught instanceof AICreditAdminError) return error(caught.code, caught.message, caught.code === "NOT_FOUND" ? 404 : caught.code === "INSUFFICIENT_CREDITS" ? 409 : 400);
    console.error("Failed to apply admin AI credit operation:", caught);
    return error("INTERNAL_ERROR", "Could not apply credit operation", 500);
  }
}
