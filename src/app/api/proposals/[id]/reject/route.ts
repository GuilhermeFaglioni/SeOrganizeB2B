import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { rejectProposal } from "@/lib/financial/proposals-service";
import { mapFinancialError } from "@/lib/financial/http";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  try {
    const proposal = await rejectProposal(
      params.id,
      typeof body.reason === "string" ? body.reason : null
    );
    return NextResponse.json({ data: proposal, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
