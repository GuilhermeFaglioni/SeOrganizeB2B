import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  getAICreditBalance,
  getAICreditLedgerHistory,
} from "@/lib/ai/credit-ledger";
import {
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";
import { AICreditLedgerError } from "@/lib/ai/credit-ledger";
import { getMemberCreditLimitUsage } from "@/lib/ai/member-credit-limits";
import { getActiveManagedAICycle } from "@/lib/ai/managed-cycle";

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  try {
    const [balance, history, cycle, memberLimit] = await Promise.all([
      getAICreditBalance(access.tenantId),
      getAICreditLedgerHistory(access.tenantId),
      getActiveManagedAICycle({ tenantId: access.tenantId, actorId: user.id }),
      getMemberCreditLimitUsage(access.tenantId, user.id),
    ]);
    return NextResponse.json({ data: { balance, history, cycle, memberLimit }, error: null });
  } catch (error) {
    if (error instanceof AICreditLedgerError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: error.code === "CONFLICT" ? 409 : error.code === "LIMIT_EXCEEDED" ? 429 : 400 },
      );
    }
    console.error("AI credit balance operation failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Não foi possível consultar os créditos do AI Studio." } },
      { status: 500 },
    );
  }
}
